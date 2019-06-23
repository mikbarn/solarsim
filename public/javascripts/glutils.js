
function getGLContext(canvas) {
      var gl = canvas.getContext("webgl");
      if (!gl) {
        console.log("No GL!");
      }
      else {
        console.log("Cooking with GL");
      }
    return gl;
}

function createShader(gl, type, source) {
    let shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    let success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }
    console.log('ERROR compiling ' + type + ' shader!!!');
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
          
}
 
function createProgram(gl, vert_shad, frag_shad) {
    var program = gl.createProgram();
    gl.attachShader(program, vert_shad);
    gl.attachShader(program, frag_shad);
    gl.linkProgram(program);
    let success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }
    console.log('ERROR creating/linking program!!!');
    gl.deleteProgram(program);
}


function getProgram(gl, vs, fs) {
    let vert_shader = createShader(gl, gl.VERTEX_SHADER, vs);
    let frag_shader = createShader(gl, gl.FRAGMENT_SHADER, fs);
    if (vert_shader && frag_shader) {
        return createProgram(gl, vert_shader, frag_shader);
    }
    else {
        console.log('FUBAR!');
    }
    return null;
}

export {getProgram, createProgram, getGLContext};