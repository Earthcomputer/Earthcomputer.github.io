// WebGL - Textures - Skybox
// from https://webglfundamentals.org/webgl/webgl-skybox.html


function main() {
    // Get A WebGL context
    /** @type {HTMLCanvasElement} */
    var canvas = document.querySelector("#canvas");
    var gl = canvas.getContext("webgl");
    $('#canvas').click(()=>{
        canvas.requestPointerLock();
    });
    var deltaX = 0, deltaY = 0;
    addEventListener('mousemove', e => {
        if (document.pointerLockElement != null) {
            deltaX = event.movementX;
            deltaY = event.movementY;
        }
    });
    if (!gl) {
        return;
    }

    // setup GLSL program
    var program = webglUtils.createProgramFromScripts(gl, ["vertex-shader-3d", "fragment-shader-3d"]);

    // look up where the vertex data needs to go.
    var positionLocation = gl.getAttribLocation(program, "a_position");

    // lookup uniforms
    var skyboxLocation = gl.getUniformLocation(program, "u_skybox");
    var viewDirectionProjectionInverseLocation =
        gl.getUniformLocation(program, "u_viewDirectionProjectionInverse");

    // Create a buffer for positions
    var positionBuffer = gl.createBuffer();
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // Put the positions in the buffer
    setGeometry(gl);

    // Create a texture.
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

    const faceInfos = [
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,//correct
            url: 'images/panorama/3.png',
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            url: 'images/panorama/1.png',
        },
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, // Y is correct
            url: 'images/panorama/4.png',
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            url: 'images/panorama/5.png',
        },
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
            url: 'images/panorama/0.png',
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, // Correct
            url: 'images/panorama/2.png',
        },
    ];
    faceInfos.forEach((faceInfo) => {
        const {target, url} = faceInfo;

        // Upload the canvas to the cubemap face.
        const level = 0;
        const internalFormat = gl.RGBA;
        const width = 512;
        const height = 512;
        const format = gl.RGBA;
        const type = gl.UNSIGNED_BYTE;

        // setup each face so it's immediately renderable
        gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, null);

        // Asynchronously load an image
        const image = new Image();
        requestCORSIfNotSameOrigin(image, url);
        image.src = url;
        image.addEventListener('load', function() {
            // Now that the image has loaded make copy it to the texture.
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
            gl.texImage2D(target, level, internalFormat, format, type, image);
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        });
    });
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

    function radToDeg(r) {
        return r * 180 / Math.PI;
    }

    function degToRad(d) {
        return d * Math.PI / 180;
    }

    var fieldOfViewRadians = degToRad(90);
    var cameraYRotationRadians = degToRad(0);

    var spinCamera = true;
    // Get the starting time.
    var then = 0;

    requestAnimationFrame(drawScene);
    var rotX = 0, rotY = 180;
    // Draw the scene.
    function drawScene(time) {
        // convert to seconds
        time *= 0.001;
        // Subtract the previous time from the current time
        var deltaTime = time - then;
        // Remember the current time for the next frame.
        then = time;
        rotX += deltaX * 0.05;
        rotY += deltaY * 0.05;
        webglUtils.resizeCanvasToDisplaySize(gl.canvas);

        // Tell WebGL how to convert from clip space to pixels
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        // Clear the canvas AND the depth buffer.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Tell it to use our program (pair of shaders)
        gl.useProgram(program);

        // Turn on the position attribute
        gl.enableVertexAttribArray(positionLocation);

        // Bind the position buffer.
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

        // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
        var size = 2;          // 2 components per iteration
        var type = gl.FLOAT;   // the data is 32bit floats
        var normalize = false; // don't normalize the data
        var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
        var offset = 0;        // start at the beginning of the buffer
        gl.vertexAttribPointer(
            positionLocation, size, type, normalize, stride, offset);

        // Compute the projection matrix
        var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        var projectionMatrix =
            m4.perspective(fieldOfViewRadians, aspect, 1, 2000);
        if (rotY > 269.9) {rotY = 269.9;}
        if (rotY < 90.1) {rotY = 90.1;}
        // camera going in circle 2 units from origin looking at origin
        var cameraPosition = [0,0,0];
        var matX = m4.yRotation(degToRad(-rotX));
        var matY = m4.zRotation(degToRad(rotY));
        var rot = m4.multiply(matX, matY);
        var target = [1, 0, 0, 0];
        target = m4.transformVector(rot, target);

        var up = [0, 1, 0];
        // Compute the camera's matrix using look at.
        var cameraMatrix = m4.lookAt(cameraPosition, target, up);

        // Make a view matrix from the camera matrix.
        var viewMatrix = m4.inverse(cameraMatrix);

        // We only care about direciton so remove the translation
        viewMatrix[12] = 0;
        viewMatrix[13] = 0;
        viewMatrix[14] = 0;

        var viewDirectionProjectionMatrix =
            m4.multiply(projectionMatrix, viewMatrix);
        var viewDirectionProjectionInverseMatrix =
            m4.inverse(viewDirectionProjectionMatrix);

        // Set the uniforms
        gl.uniformMatrix4fv(
            viewDirectionProjectionInverseLocation, false,
            viewDirectionProjectionInverseMatrix);

        // Tell the shader to use texture unit 0 for u_skybox
        gl.uniform1i(skyboxLocation, 0);

        // let our quad pass the depth test at 1.0
        gl.depthFunc(gl.LEQUAL);

        // Draw the geometry.
        gl.drawArrays(gl.TRIANGLES, 0, 1 * 6);
        deltaX = 0;
        deltaY = 0;
        requestAnimationFrame(drawScene);
    }
}

// Fill the buffer with the values that define a quad.
function setGeometry(gl) {
    var positions = new Float32Array(
        [
            -1, -1,
            1, -1,
            -1,  1,
            -1,  1,
            1, -1,
            1,  1,
        ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
}

window.onload = main;


// This is needed if the images are not on the same domain
// NOTE: The server providing the images must give CORS permissions
// in order to be able to use the image with WebGL. Most sites
// do NOT give permission.
// See: https://webglfundamentals.org/webgl/lessons/webgl-cors-permission.html
function requestCORSIfNotSameOrigin(img, url) {
    if ((new URL(url, window.location.href)).origin !== window.location.origin) {
        img.crossOrigin = "";
    }
}