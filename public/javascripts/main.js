import {genUnitSphereMesh, TriMesh} from './geo3d.js';
import {Vec3, Mat4, Quat} from './mb-matrix.js';
import {getProgram, getGLContext} from './glutils.js';

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
resources.load_shader('simplevs.txt', 's_vs');
resources.load_shader('simplefs.txt', 's_fs');
resources.load_image('earth.png', 'earth');
resources.load_image('moon.jpg', 'moon');
resources.load_image('sun.jpg', 'sun');

var handle;

class Camera {
    constructor() {
        this.velocity = [0,0,0];
        this.pos = [0,0, -10];
        this.v_up = [0, 1,0];
        this.dir = [0, 0, 1];
        this.zoom = 1;
        this.theta_x = 0.0;
        this.theta_y = 0.0;
        this.omega_x = 0.0;
        this.omega_y = 0.0;
        
        let cam = this;
        let settings = {
            cam_forward: [0,0,1],
            cam_back: [0,0,-1],
            cam_strafe_left: [-1,0,0],
            cam_strafe_right: [1,0,0],
            cam_rise: [0,1,0],
            cam_fall: [0,-1,0],
        }
        let move_slider = document.getElementById("movement_speed");
        Object.keys(settings).forEach((k) => {
            document.getElementById(k).onmousedown = (ev) => {Vec3.scale(cam.velocity, Vec3.create(...settings[k]), parseFloat(move_slider.value)); };
            document.getElementById(k).onmouseup = (ev) => {cam.velocity = [0,0,0]};
        });
        let get_rot_speed = function() { return parseFloat(document.getElementById("rotate_speed").value) };
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
    }

    update(delta) {
        this.pos = Vec3.add(this.pos, this.pos, this.velocity);
        this.theta_x += this.omega_x;
        this.theta_y += this.omega_y;
        console.log('Cam: ', this.pos, this.velocity, this.theta_x, this.theta_y);
    }
    
    get matrix() {
        let mat = Mat4.perspective(Mat4.identity(), 45, aspect, 1.0, 1000);
        let mrot = Mat4.identity(), mtran = Mat4.identity();
        Mat4.rotate(mrot, mrot, this.theta_x, Vec3.create(1, 0, 0));
        Mat4.rotate(mrot, mrot, this.theta_y, Vec3.create(0, 1, 0));
        Mat4.translate(mtran, mtran, this.pos);
        Mat4.multiply(mat, mat, mtran);
        return mat;
    }
}

class Planet {
    constructor(pos, vel, omega, radius, axial_tilt, image) {
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
        this.program = getProgram(gl, resources.shaders.s_vs, resources.shaders.s_fs);
        this.vertex_buffer = gl.createBuffer();
        this.tri_buffer = gl.createBuffer();
        this.tex_buffer = gl.createBuffer();
        this.obj_data = {};
        this.obj_list = object_list;
        this.buffer_objects(gl);
    }

    buffer_objects(gl) {
        gl.useProgram(this.program);
        let tex_coord_loc = gl.getAttribLocation(this.program, "a_tex_coord");
        let pos_att_loc = gl.getAttribLocation(this.program, "a_position");
        let tex_coord_offset = 0;
        let pos_offset = 0;
        let index_offset = 0;
        for (let i = 0; i < this.obj_list.length; i++) {
            let tex = gl.createTexture();
            let obj = this.obj_list[i];
            let mesh = obj.triangle_mesh;

            this.obj_data[obj] = {
                tex_coord_offset: tex_coord_offset,
                pos_offset: pos_offset,
                index_offset: index_offset,
                texture: tex
            }
            //gl.activeTexture(gl.TEXTURE0+i) 
            //gl.bindTexture(gl.TEXTURE_2D, tex);
            //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, obj.image);
            //gl.generateMipmap(gl.TEXTURE_2D);

            gl.bindBuffer(gl.ARRAY_BUFFER, this.tex_buffer);
            gl.bufferData(gl.ARRAY_BUFFER, mesh.tex_coords, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(tex_coord_loc);
            gl.vertexAttribPointer(tex_coord_loc, 2, gl.FLOAT, false, 0, 0);
            tex_coord_offset += mesh.tex_coords.length / 2;
            
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex_buffer);
            gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(pos_att_loc);
            gl.vertexAttribPointer(pos_att_loc, 3, gl.FLOAT, false, 0, 0);
            pos_offset += mesh.vertices.length; 
    
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.tri_buffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.tri_indices, gl.STATIC_DRAW);
            index_offset += mesh.tri_indices;
        }
    }

    draw(gl) {
        gl.useProgram(this.program); 
        gl.viewport(0,0, gl.canvas.width, gl.canvas.height);
        aspect = gl.canvas.width / gl.canvas.height;
        gl.clearColor(0,0,0,0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);

        let model_mat_loc = gl.getUniformLocation(this.program, 'model_matrix');
        let view_mat_loc = gl.getUniformLocation(this.program, 'view_matrix');
        gl.uniformMatrix4fv(view_mat_loc, false, cam.matrix);
        for (let i = 0; i < this.obj_list.length; i++) {
            let obj = this.obj_list[i];
            let obj_data = this.obj_data[obj];
            gl.bindTexture(gl.TEXTURE_2D, obj_data.texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, obj.image);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.uniformMatrix4fv(model_mat_loc, false, obj.matrix);
            gl.drawElements(gl.TRIANGLES, obj.triangle_mesh.tri_indices.length, gl.UNSIGNED_SHORT, obj_data.index_offset);
        }
    }
}
var aspect = 1;
var cam = new Camera();
var sim_paused = false;
async function start() {
    let can = document.getElementById("canvas_1");
    let gl = getGLContext(can);
    let timer = new Timer();
    
    await resources.wait_until_loaded();
    
    let earth = new Planet(Vec3.create(), Vec3.create(), .1, 1, .4, resources.images.earth); 
    let moon = new Planet(Vec3.create(10,0,0), Vec3.create(), .3, .25, 0, resources.images.moon);
    let sun = new Planet(Vec3.create(0,0,-60), Vec3.create(), .03, 50, 0, resources.images.sun);
    let objs = [earth, moon, sun];
    let renderer = new Renderer(gl, objs);
    handle = window.setInterval(()=> {
        try { 
            timer.start(); 
            cam.update(.1);
            if (!sim_paused) {
                objs.forEach((o)=>{o.update(.1)});
            }
            renderer.draw(gl);
            console.log(timer.stop() + ' ms');
            //window.clearInterval(handle);
        }
        catch(error) {
            console.log(error);
            window.clearInterval(handle);;
        }
    }, 100);
}


$(document).ready(function() {
    document.getElementById("pause_sim").onclick = (ev) => {sim_paused = !sim_paused};
    start();
});