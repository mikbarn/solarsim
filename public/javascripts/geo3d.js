import {Vec3, Mat4, Quat} from "./mb-matrix.js";

class Body {
    constructor(mesh, pos, orient, omega = 0.0) {
        this.mesh = mesh;
        this.pos = pos;
        this.orient = orient;
        this.omega = omega;
    }

    update(time_delta) {
        
    }
}



class TriMesh {
    constructor() {
        this.vertices = null;
        this.tri_indices = null;
        this.norms = null;
        this.tex_coord = null;
    }
}

function genUnitSphereMesh(lat, long) {
    let theta_inc = Math.PI / (lat + 1);
    let phi_inc = Math.PI / (long + 1);

    let sin = Math.sin;
    let cos = Math.cos;

    let vertices = [0,1,0]; // north pole
    let tri_idxs = [];

    let vertices_per_lat = (long*2)+2;
    for (let i=1; i <=lat; i++) {
        let theta = theta_inc * i;
        for (let j=0; j<vertices_per_lat; j++) {
            let phi = phi_inc * j;
            //console.log('PHI ' + phi )
            vertices.push(cos(phi)*sin(theta), cos(theta), sin(phi)*sin(theta));
            //console.log(Math.sqrt(sin(phi)*sin(theta)*sin(phi)*sin(theta) + cos(theta)*cos(theta) + cos(phi)*sin(theta)*cos(phi)*sin(theta)))
        }
    }
    vertices.push(0,-1,0); // south pole

    for(let i=0; i<vertices_per_lat; i++) {
        tri_idxs.push(0, i+1, (i+2) < vertices_per_lat+1 ? i+2: 1);
    }
    let sp_idx = (vertices.length / 3) - 1;
    console.log('sp idx ' + sp_idx);
    for(let i=0; i<lat-1; i++) {
        let k = 1+vertices_per_lat*i;
        //console.log('K ' + k)
        for(let j=0; j<vertices_per_lat; j++) {
            let m = k+j;
            let n =  m+vertices_per_lat+1;
            if (j< vertices_per_lat-1) {
                tri_idxs.push(m, m+vertices_per_lat, n);
                tri_idxs.push(m, n, m+1);
            }
            else {
                tri_idxs.push(m, m+vertices_per_lat, k+vertices_per_lat);
                tri_idxs.push(m, k+vertices_per_lat, k); 
            }

        }
    }
    
    console.log('VPL ' + vertices_per_lat);
    
    for (let i=vertices_per_lat; i>0; i--) {
        tri_idxs.push(sp_idx-i, sp_idx, (sp_idx - i + 1) < sp_idx? (sp_idx - i+1): sp_idx - vertices_per_lat)
    }
   
    let norms = [];
    for (let i=0; i<tri_idxs.length; i=i+3) {
        let i1 = tri_idxs[i];
        let i2 = tri_idxs[i+1];
        let i3 = tri_idxs[i+2];
        let p1 = [vertices[i1], vertices[i1+1], vertices[i1+2]];
        let p2 = [vertices[i2], vertices[i2+1], vertices[i2+2]];
        let p3 = [vertices[i3], vertices[i3+1], vertices[i3+2]];
        let e1 = Vec3.subtract(Vec3.create(), p2, p1), e2 = Vec3.subtract(Vec3.create(), p3, p2);
        //console.log(e1 + ' -EDGES- ' + e2)
        norms.push(...Vec3.normalize(e1, Vec3.cross(e1, e1, e2)));
    }

    let tex_coords = [];
    for (let i=0; i<vertices.length; i=i+3) {
        let x = vertices[i];
        let y = vertices[i+1];
        let z = vertices[i+2];
        let v = 0.5-(Math.asin(y)/Math.PI);
        let u = (Math.atan2(z, x) / (Math.PI*2)) + 0.5;
        tex_coords.push(u, v); //wikipedia!
    }
     
    let tm = new TriMesh();
    tm.vertices = new Float32Array(vertices);
    tm.tri_indices = new Uint16Array(tri_idxs);
    tm.norms = new Float32Array(norms);
    tm.tex_coords = new Float32Array(tex_coords);
    return tm;
}

export {TriMesh, genUnitSphereMesh};
