import {genUnitSphereMesh, TriMesh, SkyBoxVertices} from './geo3d.js';
import {Vec3, Mat4, Quat} from './mb-matrix.js';
import {getProgram, getGLContext} from './glutils.js';
import {Fixed, EARTH_RADIUS} from './constants.js';

const PX = 'px', PY = 'py', PZ = 'pz', NX = 'nx', NY = 'ny', NZ = 'nz'
const SKY_IMAGES = [PX, PY, PZ, NX, NY, NZ];

class Resources {

    constructor() {
        this.shaders = {};
        this.images = {}; 
    }

    async load_shader(url, name) {
        this.shaders[name] = null;
        let resp = await fetch('shaders/'+url);
        let txt = await resp.text();
        this.shaders[name] = txt;        
    }

    async load_image(url, name) {
        this.images[name] = null;
        var image = new Image();
        
        image.src = 'images/'+url;
        await image.decode();
        this.images[name] = image;     
    }

    is_done() {
        let has_non_null_elements_only = true;          
        [this.shaders, this.images].map((v,i,a) => {
            //console.log(v, i, a);
            has_non_null_elements_only &= (Object.keys(v).length > 0 && !Object.values(v).includes(null));
        });
        return has_non_null_elements_only;
    }

    async wait_until_loaded(timeout_sec=10) {
        return new Promise(async (resolve, reject) => {
            var elapsed_ms = 0.0, interval_ms = 50;
            while (elapsed_ms/1000 < timeout_sec) {
                await new Promise(res => {setTimeout(() => {res();}, interval_ms)});
                elapsed_ms += interval_ms;
                if (this.is_done()) { 
                    return resolve();
                }
            }
            reject('Taking too long!');
        });
    }
}

class Timer {
    constructor() {
        this.started_at = 0;
        this.time = 0;
    }
    start() {
        this.started_at = new Date().getTime(); 
        return this.started_at;
    }

    stop() {
        this.time = new Date().getTime()- this.started_at; 
        return this.time
    }
}

var resources = new Resources();
resources.load_shader('mainvs.txt', 's_vs');
resources.load_shader('mainfs.txt', 's_fs');
resources.load_shader('meshfs.txt', 'mesh_fs');
resources.load_shader('skyvs.txt', 'sky_vs');
resources.load_shader('skyfs.txt', 'sky_fs');
resources.load_image('earth_daytime.jpg', 'earth');
resources.load_image('moon.jpg', 'moon');
resources.load_image('sun.jpg', 'sun');

SKY_IMAGES.forEach((v,i,a) => {
    resources.load_image(`skybox/${v}.png`, v);
});

var handle;

class Camera {
    constructor(pos=[0, 0, 500]) {
        this.velocity = [0,0,0];
        this.pos = pos;
        this.up = [0, 1,0];
        this.dir = [0, 0, 1];
        this.right = [1, 0, 0]
        this.zoom = 1;
        this.theta_x = 0.0;
        this.theta_y = 0.0;
        this.omega_x = 0.0;
        this.omega_y = 0.0;
        this.rot_mat = new Float32Array([...this.right, 0, ...this.up, 0, ...this.dir, 0, 0, 0, 0, 1])
        this._aspect = 1;
        this._fovY = .90;
        this._maxZ = Infinity;
        this.p_mat = Mat4.perspective(Mat4.identity(), this._fovY, this._aspect, 1.0,  this._maxZ);
        this._slerp = {start: null, end: null, t: 0.0};
        
        let cam = this;
        let neg = Vec3.negate;
       
        let settings = {
            cam_forward: () => neg(cam.dir),
            cam_back: () => cam.dir,
            cam_strafe_left: () => neg(cam.right),
            cam_strafe_right: () => cam.right,
            cam_rise: () => cam.up,
            cam_fall: () => neg(cam.up),
        }
        let move_slider = document.getElementById("movement_speed");
        Object.keys(settings).forEach((k) => {
            document.getElementById(k).onmousedown = (ev) => {Vec3.scale(cam.velocity, settings[k](), parseFloat(move_slider.value)); };
            document.getElementById(k).onmouseup = (ev) => {cam.velocity = [0,0,0]};
        });
        var get_rot_speed = function() { return parseFloat(document.getElementById("rotate_speed").value) };
        let angles = {
            cam_tilt_up: (ev) => {cam.omega_x = get_rot_speed()},
            cam_tilt_down: (ev) => {cam.omega_x = -get_rot_speed()},
            cam_tilt_left: (ev) => {cam.omega_y = get_rot_speed()},
            cam_tilt_right: (ev) => {cam.omega_y = -get_rot_speed()},  
        }
        Object.keys(angles).forEach((k) => {
            document.getElementById(k).onmousedown = angles[k];
            document.getElementById(k).onmouseup = (ev) => {cam.omega_x = 0.0, cam.omega_y = 0.0};
        });

        document.getElementById("cam_recenter").onclick = (ev) => {
            cam.up = [0,1,0];
            Vec3.cross(cam.dir, cam.right, cam.up);
            Vec3.cross(cam.right, cam.up, cam.dir);
            let rot_mat = this.rot_mat;
            rot_mat[4] =  this.up[0];
            rot_mat[5] =  this.up[1];
            rot_mat[6] =  this.up[2];

            rot_mat[0] =  this.right[0];
            rot_mat[1] =  this.right[1];
            rot_mat[2] =  this.right[2];

            rot_mat[8] =  this.dir[0];
            rot_mat[9] =  this.dir[1];
            rot_mat[10] =  this.dir[2];
        };
    }

    set_dirs() {
        let rot_mat = this.rot_mat;
        this.up[0] = rot_mat[4];
        this.up[1] = rot_mat[5];
        this.up[2] = rot_mat[6];

        this.dir[0] = rot_mat[8];
        this.dir[1] = rot_mat[9];
        this.dir[2] = rot_mat[10];

        this.right[0] = rot_mat[0];
        this.right[1] = rot_mat[1];
        this.right[2] = rot_mat[2];        
    }

    update(delta) {
        if (this.omega_x !== 0.0 || this.omega_y !== 0.0) {
            let d_theta_x = this.omega_x*delta;
            let d_theta_y = this.omega_y*delta;
            let rot_mat = this.rot_mat;

            Mat4.rotateY(rot_mat, rot_mat, d_theta_y);
            Mat4.rotateX(rot_mat, rot_mat, d_theta_x);
            this.set_dirs();
            this.rot_mat = rot_mat;
            console.log('Cam: ', this.pos, this.velocity, 'Dir:',this.dir, 'Right:', this.right, this.up, 'Len ', Vec3.len(this.dir));
        }

        if (Tracking.tracking && this._slerp.t === 0.0) {
            let qstart = Quat.identity(), qend = Quat.identity();
            let to = Vec3.subtract(Vec3.create(), Tracking.tracked.pos, this.pos);
            Vec3.normalize(to, to);
            to = Vec3.negate(to);
            
            let up = Vec3.create(0,1,0);
            let right = Vec3.cross(Vec3.create(), up, to);
            up = Vec3.cross(up, to, right);
            let m = new Float32Array([...right, 0, ...up, 0, ...to, 0, 0, 0, 0, 1]);
            Mat4.fromQuat(Mat4.identity(), Quat.fromMat3(qend, Mat4.toMat3(m)));

            Quat.fromMat3(qstart, Mat4.toMat3(this.rot_mat));
            this.set_dirs();
            this._slerp = {start: qstart, end: qend, t: 0.001}
            console.log('To ', to, 'Dir ', this.dir);
            
        }
        let max = 1.0;
        if (this._slerp.t > 0) {
            this._slerp.t = Math.min(max, this._slerp.t + delta)
            let q = Quat.slerp(Quat.identity(), this._slerp.start, this._slerp.end, this._slerp.t);
            Mat4.fromQuat(this.rot_mat, q);
            console.log('Tracking...', this._slerp.t);
            this.set_dirs();
        }
        if (this._slerp.t >= max) {
            console.log('Cam: ', this.pos, this.velocity, 'Dir:', Vec3.negate(this.dir), 'Right:', this.right, this.up, 'Len ', Vec3.len(this.dir));
            Tracking.tracking = false;
            this._slerp.t = 0.0;
            let to =  Vec3.subtract(Vec3.create(), Tracking.tracked.pos, this.pos);
            Vec3.normalize(to, to);
        }
        
        this.pos = Vec3.add(this.pos, this.pos, this.velocity);
        //console.log('Cam: ', this.pos, this.velocity, 'Dir:', this.dir, 'Right:', this.right, this.up);
    }
    
    get_matrix(aspect) {
        if (this._aspect !== aspect) {
            this.p_mat = Mat4.perspective(Mat4.identity(), this._fovY, aspect, 1.0,  this._maxZ);
            this._aspect = aspect;
        }
        let mat = Mat4.identity();
        //let mrot = new Float32Array([...this.right, 0, ...this.up, 0, ...this.dir, 0, 0, 0, 0, 1])
        Mat4.translate(mat, mat, this.pos);
        Mat4.multiply(mat, mat, this.rot_mat);
        Mat4.invert(mat, mat);
        Mat4.multiply(mat, this.p_mat, mat);
        return mat;
    }
}

class Planet {
    constructor(pos, vel, omega, radius, axial_tilt, image, display) {
        this.pos = pos;
        this.vel = vel;
        this.radius = radius;
        this.axial_tilt = axial_tilt;
        this.image = image;
        this.triangle_mesh = genUnitSphereMesh(20, 20);
        this.dir = [0,0, 1];
        this.v_up = [Math.sin(axial_tilt), Math.cos(axial_tilt), 0];
        this.theta = 0.0;
        this.omega = omega;
        this.rot_mat = Mat4.identity();
        this.instrinsic = 0.0;
        this.display = display
    }

    update(delta) {
        this.theta += (this.omega * delta);
    }

    get matrix()  {
        let q = Quat.identity();
        Quat.setAxisAngle(q, this.v_up, this.theta);
        let model_matrix = Mat4.fromQuat(Mat4.identity(), q);
        let sc = Vec3.create(this.radius, this.radius, this.radius);
        Mat4.scale(model_matrix, model_matrix, sc);
        let tm = Mat4.identity();
        Mat4.translate(tm, tm, Vec3.create(...this.pos));
        Mat4.multiply(model_matrix, tm, model_matrix);
        return model_matrix;
    }
}


class Renderer {
    constructor(gl, object_list) {
        let main = getProgram(gl, resources.shaders.s_vs, resources.shaders.s_fs);
        let mesh = getProgram(gl, resources.shaders.s_vs, resources.shaders.mesh_fs);
        let sky = getProgram(gl, resources.shaders.sky_vs, resources.shaders.sky_fs);
        
        this.main = {
            prog: main,
            tex_coord_loc: gl.getAttribLocation(main, "a_tex_coord"),
            pos_att_loc: gl.getAttribLocation(main, "a_position"),
            model_mat_loc: gl.getUniformLocation(main, 'model_matrix'),
            view_mat_loc: gl.getUniformLocation(main, 'view_matrix'),
            light_pos_loc: gl.getUniformLocation(main, 'u_world_light_pos'),
            intrinsic_loc: gl.getUniformLocation(main, 'u_intrinsic_bright'),
        };

        this.mesh = {
            prog: mesh,
            tex_coord_loc: gl.getAttribLocation(mesh, "a_tex_coord"),
            pos_att_loc: gl.getAttribLocation(mesh, "a_position"),
            model_mat_loc: gl.getUniformLocation(mesh, 'model_matrix'),
            view_mat_loc: gl.getUniformLocation(mesh, 'view_matrix'),
            // light_pos_loc: gl.getUniformLocation(mesh, 'u_world_light_pos'),
            // intrinsic_loc: gl.getUniformLocation(mesh, 'u_intrinsic_bright'),
        };
        let m = Mat4.identity();
        this.sky = {
            prog: sky,
            sampler_cube_loc: gl.getUniformLocation(sky, 'u_sampler_cube'),
            view_mat_loc: gl.getUniformLocation(sky, 'view_matrix'),
            pos_att_loc: gl.getAttribLocation(sky, 'a_position'),
            texture: gl.createTexture(),
            texture_targets: {
                [PX]: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
                [PY]: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
                [PZ]: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
                [NX]: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                [NY]: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                [NZ]: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
            },
            v_buffer: gl.createBuffer(),
            scale_matrix: Mat4.scale(m, m, [100000, 100000, 100000]),
        }
        this.obj_data = {};
        this.obj_list = object_list;
       
        this.main_enabled = true;
        document.getElementById("toggle_shader").onclick = (ev) => {
            this.main_enabled = !this.main_enabled;
        }
        this.buffer_objects(gl);
    }

    buffer_objects(gl) {
        for (let i = 0; i < this.obj_list.length; i++) {
            let obj = this.obj_list[i];
            let mesh = obj.triangle_mesh;
      
            let texture = gl.createTexture();
            let v_buffer = gl.createBuffer();
            let t_buffer = gl.createBuffer();
            let i_buffer = gl.createBuffer();

            gl.bindBuffer(gl.ARRAY_BUFFER, t_buffer);
            gl.bufferData(gl.ARRAY_BUFFER, mesh.tex_coords, gl.STATIC_DRAW);

            gl.bindBuffer(gl.ARRAY_BUFFER, v_buffer);
            gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, i_buffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.tri_indices, gl.STATIC_DRAW);

            this.obj_data[obj] = {
                texture: texture,
                v_buffer: v_buffer,
                t_buffer: t_buffer,
                i_buffer: i_buffer
            };
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.sky.v_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, SkyBoxVertices, gl.STATIC_DRAW);
    }

    draw(gl) {
        
        let w = gl.canvas.clientWidth, h = gl.canvas.clientHeight;
        gl.canvas.width = w;
        gl.canvas.height = h;
        gl.viewport(0,0, w, h);
        let aspect = parseFloat(w) / parseFloat(h);
        //console.log('Aspect: ', aspect, w, h);
        gl.clearColor(0,0,0,0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        //gl.enable(gl.CULL_FACE);
        let cam_view_mat = cam.get_matrix(aspect);
        
        let source = this.main_enabled? this.main: this.mesh;

        var {pos_att_loc, tex_coord_loc, prog, model_mat_loc, view_mat_loc, light_pos_loc, intrinsic_loc} = source;
        gl.useProgram(prog); 
        gl.uniformMatrix4fv(view_mat_loc, false, cam_view_mat);
        gl.uniform3fv(light_pos_loc, Vec3.create(0, 0, 0));
        for (let i = 0; i < this.obj_list.length; i++) {
            let obj = this.obj_list[i];
            let {texture, v_buffer, t_buffer, i_buffer} =  this.obj_data[obj];

            gl.bindBuffer(gl.ARRAY_BUFFER, v_buffer);
            gl.enableVertexAttribArray(pos_att_loc);
            gl.vertexAttribPointer(pos_att_loc, 3, gl.FLOAT, false, 0, 0);

            gl.uniformMatrix4fv(model_mat_loc, false, obj.matrix);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, i_buffer);
            
            if (this.main_enabled) {
                gl.bindBuffer(gl.ARRAY_BUFFER, t_buffer)
                gl.enableVertexAttribArray(tex_coord_loc);
                gl.vertexAttribPointer(tex_coord_loc, 2, gl.FLOAT, false, 0, 0);

                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, obj.image);
                gl.generateMipmap(gl.TEXTURE_2D);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

                gl.uniform1f(intrinsic_loc, obj.instrinsic);
    
                gl.drawElements(gl.TRIANGLES, obj.triangle_mesh.tri_indices.length, gl.UNSIGNED_SHORT, 0);
            }
            else {
                //gl.drawArrays(gl.LINE_STRIP, 0, obj.triangle_mesh.vertices.length/3);
                gl.drawElements(gl.LINE_STRIP, obj.triangle_mesh.tri_indices.length, gl.UNSIGNED_SHORT, 0);
            }
        }
        
        var {pos_att_loc, prog, texture, sampler_cube_loc, view_mat_loc, texture_targets, v_buffer, scale_matrix} = this.sky;
        gl.useProgram(prog);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
        
        SKY_IMAGES.forEach((v,i,a) => {
            gl.texImage2D(texture_targets[v], 0,  gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, resources.images[v]);
        });
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        let m = Mat4.identity();
        Mat4.multiply(m, m, cam.rot_mat);
        Mat4.invert(m, m);
        Mat4.multiply(m, scale_matrix, m);
        Mat4.multiply(m, cam.p_mat, m);
        gl.uniformMatrix4fv(view_mat_loc, false, m);
        gl.uniform1i(sampler_cube_loc, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, v_buffer);
        gl.enableVertexAttribArray(pos_att_loc);
        gl.vertexAttribPointer(pos_att_loc, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 36);
        
        //gl.drawArrays(gl.LINE_STRIP, 0, 36);
    }
}
var cam = new Camera([0,0, Fixed.dist.e2s + 20]);
var sim_paused = false;
var main_canvas = document.getElementById("canvas_1");
var Tracking = {
    tracked: null,
    selected: null,
    tracking: false
}
var DisplayStats = {
    vars: {
        cam2sun: Vec3.create()
    },
    elements: {
        cam2sun: $('<h4/>')
    },
    setup: () => {
        $('#stats_overlay_1').append(DisplayStats.elements.cam2sun);
    },
    update: () => {
        Vec3.subtract(DisplayStats.vars.cam2sun, Vec3.create(), cam.pos);
        let miles = Vec3.len(DisplayStats.vars.cam2sun) * EARTH_RADIUS;

        DisplayStats.elements.cam2sun.html('Distance to Sun: ' + parseFloat(miles).toFixed(0) + ' mi');
    }

}

async function start() {
    let gl = getGLContext(main_canvas);
    let timer = new Timer();
    
    await resources.wait_until_loaded();
    
    let earth = new Planet(Vec3.create(0,0,Fixed.dist.e2s), Vec3.create(), .1, Fixed.rad.earth, .4, resources.images.earth, {name: 'Earth'}); 
    let moon = new Planet(Vec3.create(Fixed.dist.m2e,0,Fixed.dist.e2s), Vec3.create(), .3, Fixed.rad.moon, 0, resources.images.moon, {name: 'Moon'});
    let sun = new Planet(Vec3.create(0,0,0), Vec3.create(), .01, Fixed.rad.sun, 0, resources.images.sun, {name: 'Sun'});
    sun.instrinsic = 2.5;
    earth.instrinsic = .5;
    let objs = [earth, moon, sun];
    let renderer = new Renderer(gl, objs);
    handle = window.setInterval(()=> {
        if (Tracking.tracked !== null) {

        }
        try { 
            DisplayStats.update();
            timer.start(); 
            cam.update(.1);
            if (!sim_paused) {
                objs.forEach((o)=>{o.update(.1)});
            }
            renderer.draw(gl);
            //console.log(timer.stop() + ' ms');
            //window.clearInterval(handle);
        }
        catch(error) {
            console.log(error);
            console.log(gl.getError());
            window.clearInterval(handle);;
        }
    }, 100);

    objs.forEach((v,i,a) => {
        let d = $("<div/>").addClass("object_viewer");
        let d2 = $('<div/>').addClass('thumb');
        d2.append(v.image);
        d.append(d2);
        d.append("<h4>"+v.display.name+"</h4");
        d.click((ev)=> {
            if (Tracking.selected) {
                Tracking.selected.removeClass('selected_object');
            }
            d.addClass('selected_object');
            Tracking.tracked = v;
            Tracking.selected = d;
        });
        $('#objects_list').append(d);
        
    });
    $("#object_target_btn").click((ev) => {
        Tracking.tracking = true;
    });
}

document.addEventListener("DOMContentLoaded", (ev) => {
    document.getElementById("pause_sim").onclick = (ev) => {sim_paused = !sim_paused};
    DisplayStats.setup();
    start();
    
});
