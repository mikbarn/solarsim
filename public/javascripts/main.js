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

var handle;

class Camera {
    constructor() {
        this.velocity = [0,0,0];
        this.pos = [0,0, -10];
        this.v_up = [0, 1,0];
        this.dir = [0, 0, 1];
        this.zoom = 1;
        this.speed_multi = .5;
        
        let forward = document.getElementById("cam_up");
        let back = document.getElementById("cam_down");
        let cam = this;
        forward.onmousedown = (ev) => {cam.velocity = [0,0, this.speed_multi]};
        forward.onmouseup = (ev) => {cam.velocity = [0,0, 0]};
        back.onmousedown = (ev) => {cam.velocity = [0,0, -this.speed_multi]};
        back.onmouseup = (ev) => {cam.velocity = [0,0, 0]};
    }

    update(delta) {
        this.pos = Vec3.add(this.pos, this.pos, this.velocity);
        console.log(this.pos, '-- cam')
    }
    
    get matrix() {
        let mat = Mat4.perspective(Mat4.identity(), 90, 1, 1.0, 1000);
        Mat4.translate(mat, mat, this.pos);
        return mat;
    }
}

class Planet {
    constructor(pos, vel, omega, radius, axial_tilt, image, texture, vertex_buffer, tri_buffer, tex_buffer) {
        this.pos = pos;
        this.vel = vel;
        this.radius = radius;
        this.axial_tilt = axial_tilt;
        this.texture = texture;
        this.image = image;
        this.triangle_mesh = genUnitSphereMesh(20, 20);
        this.dir = [0,0, 1];
        this.v_up = [Math.sin(axial_tilt), Math.cos(axial_tilt), 0];
        this.theta = 0.0;
        this.omega = omega;

        this.vertex_buffer = vertex_buffer;
        this.tri_buffer = tri_buffer;
        this.tex_buffer = tex_buffer;
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
        return model_matrix;
    }

    buffer(gl, program) {
        let pos_buff = this.vertex_buffer, tex_buff = this.tex_buffer, index_buff = this.tri_buffer;
        let vertices = this.triangle_mesh.vertices;
        let tm = this.triangle_mesh;

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, resources.images.earth);
        gl.generateMipmap(gl.TEXTURE_2D);
    
        let tex_coord_loc = gl.getAttribLocation(program, "a_tex_coord");
        
        gl.bindBuffer(gl.ARRAY_BUFFER, tex_buff);
        gl.bufferData(gl.ARRAY_BUFFER, tm.tex_coords, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(tex_coord_loc);
        gl.vertexAttribPointer(tex_coord_loc, 2, gl.FLOAT, false, 0, 0);

        let pos_att_loc = gl.getAttribLocation(program, "a_position");
        
        gl.bindBuffer(gl.ARRAY_BUFFER, pos_buff);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(pos_att_loc);
        gl.vertexAttribPointer(pos_att_loc, 3, gl.FLOAT, false, 0, 0); 

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buff);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, tm.tri_indices, gl.STATIC_DRAW);

    }


    draw(gl) {
        let tm = this.triangle_mesh;
        gl.drawElements(gl.TRIANGLES, tm.tri_indices.length, gl.UNSIGNED_SHORT, 0);
        //gl.drawArrays(gl.POINTS, 0, tm.vertices.length/3);
    }
}

var cam = new Camera();

function start() {

    let can = document.getElementById("canvas_1");
    let gl = getGLContext(can);
    let program = null;
    let earth = null; 
    
    handle = window.setInterval(()=> {    
    if (resources.is_done()) {
        if (program == null) {
            program = getProgram(gl, resources.shaders.s_vs, resources.shaders.s_fs);
            gl.useProgram(program);
            earth = new Planet(Vec3.create(), Vec3.create(), .1, 1, .4, resources.images.earth, gl.createTexture(), gl.createBuffer(), gl.createBuffer(), gl.createBuffer());
            earth.buffer(gl, program);
        }
        earth.update(.1);
        cam.update(.1);
        //earth.buffer(gl, program);
        let ok = draw(gl, program, earth);
        if (!ok) {
            window.clearInterval(handle);
        }
        //window.clearInterval(handle);;
    }
    else {
        console.log('Loading...');
    }
    }, 100);
}

function draw(gl, program, earth) {
//    console.log(Timer.start());
    try {
        let timer = new Timer();
        timer.start(); 
        
 
        let model_mat_loc = gl.getUniformLocation(program, 'model_matrix');
        let view_mat_loc = gl.getUniformLocation(program, 'view_matrix');
        
        gl.uniformMatrix4fv(model_mat_loc, false, earth.matrix);
        gl.uniformMatrix4fv(view_mat_loc, false, cam.matrix);
        //console.log(vertices);
        //console.log(tm.tri_indices);
        //console.log(tm.norms);
        //console.log(tm.tex_coords);

        
    // vertices = new Float32Array([.5, 0, 0, .7, .2, 0,]);

        //gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 1, 1,-1]), gl.STATIC_DRAW);
        
        gl.viewport(0,0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0,0,0,0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        earth.draw(gl, program);

    
        console.log(timer.stop() + ' ms');
        return true;
    }
    catch(error) {
        console.log(error);
        return false;
    }
}

$(document).ready(function() {
    start();
});