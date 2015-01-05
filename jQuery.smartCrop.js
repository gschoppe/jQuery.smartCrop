(function($) {
    $.fn.smartCrop = function(options) {
        var settings = $.extend({
            // default settings
            weight   : .3,           // weight between color method (0) and entropy method (1)
            focus    : [null, null], // percent of width and percent of height aka {.5,.5} is focused
            //direction: [null, null], // range of {-1,-1} to {1, 1} (left up to down right)
            thumb    : true,         // do we resize the image before cropping
            testSize : 200,          // pixel size of test canvas
            slices   : 20,           // number of slices to sample
            maxReduce: .33,          // maximum reduction ratio before cropping
            debug    : false
        }, options);
        
        // scales the image by (float) scale < 1
        // returns a canvas containing the scaled image.
        var downScaleImage = function(img, scale) {
            var imgCV = document.createElement('canvas');
            imgCV.width = img.width;
            imgCV.height = img.height;
            var imgCtx = imgCV.getContext('2d');
            imgCtx.drawImage(img, 0, 0);
            return downScaleCanvas(imgCV, scale);
        }

        // scales the canvas by (float) scale < 1
        // returns a new canvas containing the scaled image.
        var downScaleCanvas = function(cv, scale) {
            if (!(scale < 1) || !(scale > 0)) return cv;
            var sqScale = scale * scale; // square scale = area of source pixel within target
            var sw = cv.width; // source image width
            var sh = cv.height; // source image height
            var tw = Math.floor(sw * scale); // target image width
            var th = Math.floor(sh * scale); // target image height
            // EDIT (credits to @Enric ) : was ceil before, and creating artifacts :  
            //                           var tw = Math.ceil(sw * scale); // target image width
            //                           var th = Math.ceil(sh * scale); // target image height
            var sx = 0, sy = 0, sIndex = 0; // source x,y, index within source array
            var tx = 0, ty = 0, yIndex = 0, tIndex = 0; // target x,y, x,y index within target array
            var tX = 0, tY = 0; // rounded tx, ty
            var w = 0, nw = 0, wx = 0, nwx = 0, wy = 0, nwy = 0; // weight / next weight x / y
            // weight is weight of current source point within target.
            // next weight is weight of current source point within next target's point.
            var crossX = false; // does scaled px cross its current px right border ?
            var crossY = false; // does scaled px cross its current px bottom border ?
            var sBuffer = cv.getContext('2d').
            getImageData(0, 0, sw, sh).data; // source buffer 8 bit rgba
            var tBuffer = new Float32Array(3 * sw * sh); // target buffer Float32 rgb
            var sR = 0, sG = 0,  sB = 0; // source's current point r,g,b
            /* untested !
            var sA = 0;  //source alpha  */    

            for (sy = 0; sy < sh; sy++) {
                ty = sy * scale; // y src position within target
                tY = 0 | ty;     // rounded : target pixel's y
                yIndex = 3 * tY * tw;  // line index within target array
                crossY = (tY != (0 | ty + scale)); 
                if (crossY) { // if pixel is crossing botton target pixel
                    wy = (tY + 1 - ty); // weight of point within target pixel
                    nwy = (ty + scale - tY - 1); // ... within y+1 target pixel
                }
                for (sx = 0; sx < sw; sx++, sIndex += 4) {
                    tx = sx * scale; // x src position within target
                    tX = 0 |  tx;    // rounded : target pixel's x
                    tIndex = yIndex + tX * 3; // target pixel index within target array
                    crossX = (tX != (0 | tx + scale));
                    if (crossX) { // if pixel is crossing target pixel's right
                        wx = (tX + 1 - tx); // weight of point within target pixel
                        nwx = (tx + scale - tX - 1); // ... within x+1 target pixel
                    }
                    sR = sBuffer[sIndex    ];   // retrieving r,g,b for curr src px.
                    sG = sBuffer[sIndex + 1];
                    sB = sBuffer[sIndex + 2];

                    /* !! untested : handling alpha !!
                       sA = sBuffer[sIndex + 3];
                       if (!sA) continue;
                       if (sA != 0xFF) {
                           sR = (sR * sA) >> 8;  // or use /256 instead ??
                           sG = (sG * sA) >> 8;
                           sB = (sB * sA) >> 8;
                       }
                    */
                    if (!crossX && !crossY) { // pixel does not cross
                        // just add components weighted by squared scale.
                        tBuffer[tIndex    ] += sR * sqScale;
                        tBuffer[tIndex + 1] += sG * sqScale;
                        tBuffer[tIndex + 2] += sB * sqScale;
                    } else if (crossX && !crossY) { // cross on X only
                        w = wx * scale;
                        // add weighted component for current px
                        tBuffer[tIndex    ] += sR * w;
                        tBuffer[tIndex + 1] += sG * w;
                        tBuffer[tIndex + 2] += sB * w;
                        // add weighted component for next (tX+1) px                
                        nw = nwx * scale
                        tBuffer[tIndex + 3] += sR * nw;
                        tBuffer[tIndex + 4] += sG * nw;
                        tBuffer[tIndex + 5] += sB * nw;
                    } else if (crossY && !crossX) { // cross on Y only
                        w = wy * scale;
                        // add weighted component for current px
                        tBuffer[tIndex    ] += sR * w;
                        tBuffer[tIndex + 1] += sG * w;
                        tBuffer[tIndex + 2] += sB * w;
                        // add weighted component for next (tY+1) px                
                        nw = nwy * scale
                        tBuffer[tIndex + 3 * tw    ] += sR * nw;
                        tBuffer[tIndex + 3 * tw + 1] += sG * nw;
                        tBuffer[tIndex + 3 * tw + 2] += sB * nw;
                    } else { // crosses both x and y : four target points involved
                        // add weighted component for current px
                        w = wx * wy;
                        tBuffer[tIndex    ] += sR * w;
                        tBuffer[tIndex + 1] += sG * w;
                        tBuffer[tIndex + 2] += sB * w;
                        // for tX + 1; tY px
                        nw = nwx * wy;
                        tBuffer[tIndex + 3] += sR * nw;
                        tBuffer[tIndex + 4] += sG * nw;
                        tBuffer[tIndex + 5] += sB * nw;
                        // for tX ; tY + 1 px
                        nw = wx * nwy;
                        tBuffer[tIndex + 3 * tw    ] += sR * nw;
                        tBuffer[tIndex + 3 * tw + 1] += sG * nw;
                        tBuffer[tIndex + 3 * tw + 2] += sB * nw;
                        // for tX + 1 ; tY +1 px
                        nw = nwx * nwy;
                        tBuffer[tIndex + 3 * tw + 3] += sR * nw;
                        tBuffer[tIndex + 3 * tw + 4] += sG * nw;
                        tBuffer[tIndex + 3 * tw + 5] += sB * nw;
                    }
                } // end for sx 
            } // end for sy

            // create result canvas
            var resCV = document.createElement('canvas');
            resCV.width = tw;
            resCV.height = th;
            var resCtx = resCV.getContext('2d');
            var imgRes = resCtx.getImageData(0, 0, tw, th);
            var tByteBuffer = imgRes.data;
            // convert float32 array into a UInt8Clamped Array
            var pxIndex = 0; //  
            for (sIndex = 0, tIndex = 0; pxIndex < tw * th; sIndex += 3, tIndex += 4, pxIndex++) {
                tByteBuffer[tIndex] = Math.ceil(tBuffer[sIndex]);
                tByteBuffer[tIndex + 1] = Math.ceil(tBuffer[sIndex + 1]);
                tByteBuffer[tIndex + 2] = Math.ceil(tBuffer[sIndex + 2]);
                tByteBuffer[tIndex + 3] = 255;
            }
            // writing result to canvas.
            resCtx.putImageData(imgRes, 0, 0);
            return resCV;
        }
        
        var getAverageColor = function(canvas, resolution) {
            var context = canvas.getContext('2d');
            var imgdata = context.getImageData(0, 0, canvas.width, canvas.height);
            var pixels  = imgdata.data;
            var pixelColor = "";
            var colorSet   = {};
            // Loop over each pixel.
            for (var i = 0, n = pixels.length; i < n; i += 4) {
                pixelColor = pixelToColor(pixels, i);
                if(typeof(colorSet[pixelColor]) == "undefined")
                    colorSet[pixelColor] = 0
                colorSet[pixelColor]++;
            }
            var tuples = [];
            for (var key in colorSet) tuples.push([key, colorSet[key]]);
            tuples.sort(function(a, b) { return a[1] < b[1] ? 1 : (a[1] > b[1] ? -1 : 0);});
            tuples = tuples.slice(0, resolution);
            var color    = {r:0,g:0,b:0,a:0};
            var colorSum = 0;
            //console.log(tuples);
            for (var i=0; i<tuples.length;i++) {
                var tempColor = hexToRgb(tuples[i][0]);
                color.r += tempColor.r*tuples[i][1];
                color.g += tempColor.g*tuples[i][1];
                color.b += tempColor.b*tuples[i][1];
                color.a += tempColor.a*tuples[i][1];
                colorSum += tuples[i][1];
            }
            //console.log(tuples);
            color.r = color.r/colorSum;
            color.g = color.g/colorSum;
            color.b = color.b/colorSum;
            color.a = color.a/colorSum;
            return color;
        }
        
        var pixelToColor = function(pixels, i) {
            return(rgbToHex(pixels[i], pixels[i+1], pixels[i+2], pixels[i+3]));
        }
        
        var rgbToHex = function(r, g, b, a) {
            return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b) + componentToHex(a);
        }
        
        var componentToHex = function(c) {
            c = Math.round(c/16)*16;
            if(c > 255) c = 255;
            var hex = c.toString(16);
            return hex.length == 1 ? "0" + hex : hex;
        }
        
        function hexToRgb(hex) {
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16),
                a: parseInt(result[3], 16)
            } : null;
        }
        
        var getColorDistance = function(color1, color2) {
            //re-weight the colors, based on human perception
            var c1 = {};
            var c2 = {};
            c1.r = 0.299*color1.r;
            c2.r = 0.299*color2.r;
            c1.g = 0.587*color1.g;
            c2.g = 0.587*color2.g;
            c1.b = 0.114*color1.b;
            c2.b = 0.114*color2.b;
            c1.a = 0.299*color1.a;
            c2.a = 0.299*color2.a;
            
            var distance = 0;
            distance += Math.pow((c1.r - c2.r),2);
            distance += Math.pow((c1.g - c2.g),2);
            distance += Math.pow((c1.b - c2.b),2);
            distance += Math.pow((c1.a - c2.a),2);
            
            distance  = Math.sqrt(distance);
            
            return distance;
        }
        
        // Filters from http://www.html5rocks.com/en/tutorials/canvas/imagefilters/
        // By Ilmari Heikkinen
        var Filters = {};
        Filters.getPixels = function(img) {
            return;
            var c,ctx;
            if (img.getContext) {
                c = img;
                try { ctx = c.getContext('2d'); } catch(e) {}
            }
            if (!ctx) {
                c = this.getCanvas(img.width, img.height);
                ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0);
            }
            return ctx.getImageData(0,0,c.width,c.height);
        };

        Filters.getCanvas = function(w,h) {
            var c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            return c;
        };

        Filters.filterImage = function(filter, image, var_args) {
            var args = [this.getPixels(image)];
            for (var i=2; i<arguments.length; i++) {
                args.push(arguments[i]);
            }
            return filter.apply(null, args);
        };

        Filters.grayscale = function(pixels, args) {
            var d = pixels.data;
            for (var i=0; i<d.length; i+=4) {
                var r = d[i];
                var g = d[i+1];
                var b = d[i+2];
                // CIE luminance for the RGB
                var v = 0.2126*r + 0.7152*g + 0.0722*b;
                d[i] = d[i+1] = d[i+2] = v
            }
            return pixels;
        };

        Filters.brightness = function(pixels, adjustment) {
            var d = pixels.data;
            for (var i=0; i<d.length; i+=4) {
                d[i] += adjustment;
                d[i+1] += adjustment;
                d[i+2] += adjustment;
            }
            return pixels;
        };

        Filters.threshold = function(pixels, threshold) {
            var d = pixels.data;
            for (var i=0; i<d.length; i+=4) {
                var r = d[i];
                var g = d[i+1];
                var b = d[i+2];
                var v = (0.2126*r + 0.7152*g + 0.0722*b >= threshold) ? 255 : 0;
                d[i] = d[i+1] = d[i+2] = v
            }
            return pixels;
        };

        Filters.tmpCanvas = document.createElement('canvas');
        Filters.tmpCtx = Filters.tmpCanvas.getContext('2d');

        Filters.createImageData = function(w,h) {
            return this.tmpCtx.createImageData(w,h);
        };

        Filters.convolute = function(pixels, weights, opaque) {
            var side = Math.round(Math.sqrt(weights.length));
            var halfSide = Math.floor(side/2);

            var src = pixels.data;
            var sw = pixels.width;
            var sh = pixels.height;

            var w = sw;
            var h = sh;
            var output = Filters.createImageData(w, h);
            var dst = output.data;

            var alphaFac = opaque ? 1 : 0;

            for (var y=0; y<h; y++) {
                for (var x=0; x<w; x++) {
                    var sy = y;
                    var sx = x;
                    var dstOff = (y*w+x)*4;
                    var r=0, g=0, b=0, a=0;
                    for (var cy=0; cy<side; cy++) {
                        for (var cx=0; cx<side; cx++) {
                            var scy = Math.min(sh-1, Math.max(0, sy + cy - halfSide));
                            var scx = Math.min(sw-1, Math.max(0, sx + cx - halfSide));
                            var srcOff = (scy*sw+scx)*4;
                            var wt = weights[cy*side+cx];
                            r += src[srcOff] * wt;
                            g += src[srcOff+1] * wt;
                            b += src[srcOff+2] * wt;
                            a += src[srcOff+3] * wt;
                        }
                    }
                    dst[dstOff] = r;
                    dst[dstOff+1] = g;
                    dst[dstOff+2] = b;
                    dst[dstOff+3] = a + alphaFac*(255-a);
                }
            }
            return output;
        };

        if (!window.Float32Array) Float32Array = Array;

        Filters.convoluteFloat32 = function(pixels, weights, opaque) {
            var side = Math.round(Math.sqrt(weights.length));
            var halfSide = Math.floor(side/2);

            var src = pixels.data;
            var sw = pixels.width;
            var sh = pixels.height;

            var w = sw;
            var h = sh;
            var output = {
                width: w, height: h, data: new Float32Array(w*h*4)
            };
            var dst = output.data;

            var alphaFac = opaque ? 1 : 0;

            for (var y=0; y<h; y++) {
                for (var x=0; x<w; x++) {
                    var sy = y;
                    var sx = x;
                    var dstOff = (y*w+x)*4;
                    var r=0, g=0, b=0, a=0;
                    for (var cy=0; cy<side; cy++) {
                        for (var cx=0; cx<side; cx++) {
                            var scy = Math.min(sh-1, Math.max(0, sy + cy - halfSide));
                            var scx = Math.min(sw-1, Math.max(0, sx + cx - halfSide));
                            var srcOff = (scy*sw+scx)*4;
                            var wt = weights[cy*side+cx];
                            r += src[srcOff] * wt;
                            g += src[srcOff+1] * wt;
                            b += src[srcOff+2] * wt;
                            a += src[srcOff+3] * wt;
                        }
                    }
                    dst[dstOff] = r;
                    dst[dstOff+1] = g;
                    dst[dstOff+2] = b;
                    dst[dstOff+3] = a + alphaFac*(255-a);
                }
            }
            return output;
        };
        var doSobelFilter = function(canvas) {
            var context = canvas.getContext('2d')
            var imgData = context.getImageData(0,0,canvas.width,canvas.height);
            var grayscale = Filters.grayscale(imgData);
            var vertical = Filters.convoluteFloat32(grayscale,
              [ -1, 0, 1,
                -2, 0, 2,
                -1, 0, 1 ]);
            var horizontal = Filters.convoluteFloat32(grayscale,
              [ -1, -2, -1,
                 0,  0,  0,
                 1,  2,  1 ]);
            var sobelImage = Filters.createImageData(vertical.width, vertical.height);
            var pixel = 0;
            for (var i=0; i<vertical.data.length; i+=4) {
                pixel = Math.max(vertical.data[i], horizontal.data[i]);
                //pixel = (vertical.data[i] + horizontal.data[i])/2;
                sobelImage.data[i  ] = pixel;
                sobelImage.data[i+1] = pixel;
                sobelImage.data[i+2] = pixel;
                sobelImage.data[i+3] = 255;
            }
       
            var newCanvas = Filters.getCanvas(sobelImage.width, sobelImage.height);
            var context   = newCanvas.getContext('2d');
            context.putImageData(sobelImage, 0, 0);
            return newCanvas;
        }
        
        var getAverageEntropy = function(sobelImage) {
            var context = sobelImage.getContext('2d')
            var imgData = context.getImageData(0,0,sobelImage.width,sobelImage.height);
            var color = 0;
            var grayLevels = {};
            for(var i=0;i<imgData.data.length;i+=4) {
                color = imgData.data[i];
                if(!(color in grayLevels))grayLevels[color] = 0
                grayLevels[color]++;
            }
            var entropy = 0;
            var pl = 0;
            for(var key in grayLevels) {
                pl = grayLevels[key]/(sobelImage.width*sobelImage.height);
                pl = pl*Math.log(pl);
                entropy -= pl;
            }
            return entropy*100;
        }
        
        var findPointOfInterest = function($img, canvas, targetFocus) {
            var ratio         = Math.min(Math.max(settings.testSize/canvas.width, settings.testSize/canvas.height),1);
            var smallCanvas   = downScaleCanvas(canvas, ratio);
            var sobel         = doSobelFilter(smallCanvas);
            sliceSize         = null;
            var avgColor      = getAverageColor(smallCanvas, 3);
            var hSliceWeights = {color:[],entropy:[],weighted:[]};
            var vSliceWeights = {color:[],entropy:[],weighted:[]};
            var sliceColor    = null;
            var sliceEntropy  = null;
            var j             = 0;
            for(var i=0;i<settings.slices;i+=1) {
                if(targetFocus[0] === null) {
                    //slice horizontally
                    var sliceSize = Math.round(smallCanvas.width/settings.slices);
                    if((i+1)*sliceSize > smallCanvas.width)
                        sliceSize = smallCanvas.width % sliceSize;
                    j = i*sliceSize;
                    var temp      = Filters.getCanvas(sliceSize, smallCanvas.height);
                    var context   = temp.getContext('2d');
                    context.clearRect ( 0, 0, sliceSize, smallCanvas.height );
                    context.drawImage(smallCanvas, j, 0, sliceSize, smallCanvas.height, 0, 0, sliceSize, smallCanvas.height);
                    sliceColor     = getAverageColor(temp, 15);
                    colorDistance  = getColorDistance(avgColor, sliceColor);
                    var temp2      = Filters.getCanvas(sliceSize, smallCanvas.height);
                    var context2   = temp2.getContext('2d');
                    context2.clearRect ( 0, 0, sliceSize, smallCanvas.height );
                    context2.drawImage(sobel, j, 0, sliceSize, smallCanvas.height, 0, 0, sliceSize, smallCanvas.height);
                    sliceEntropy  = getAverageEntropy(temp2);
                    hSliceWeights.color[i]    = colorDistance;
                    hSliceWeights.entropy[i]  = sliceEntropy;
                    hSliceWeights.weighted[i] = colorDistance*settings.weight + sliceEntropy*(1-settings.weight);
                }
                if(targetFocus[1] === null) {
                    //slice vertically
                    var sliceSize = Math.round(smallCanvas.height/settings.slices);
                    if((i+1)*sliceSize > smallCanvas.height)
                        sliceSize = smallCanvas.height % sliceSize;
                    j = i*sliceSize;
                    var temp    = Filters.getCanvas(smallCanvas.width, sliceSize);
                    var context = temp.getContext('2d');
                    context.clearRect ( 0, 0, smallCanvas.width, sliceSize);
                    context.drawImage(smallCanvas, 0, j, smallCanvas.width, sliceSize, 0, 0, smallCanvas.width, sliceSize);
                    sliceColor     = getAverageColor(temp, 15);
                    colorDistance  = getColorDistance(avgColor, sliceColor);
                    var temp2      = Filters.getCanvas(smallCanvas.width, sliceSize);
                    var context2   = temp2.getContext('2d');
                    context2.clearRect ( 0, 0, smallCanvas.width, sliceSize );
                    context2.drawImage(sobel, 0, j, smallCanvas.width, sliceSize, 0, 0, smallCanvas.width, sliceSize);
                    sliceEntropy = getAverageEntropy(temp2);
                    vSliceWeights.color[i]    = colorDistance;
                    vSliceWeights.entropy[i]  = sliceEntropy;
                    vSliceWeights.weighted[i] = colorDistance*settings.weight + sliceEntropy*(1-settings.weight);
                }
            }
            hMaxSliceColor    = hSliceWeights.color.indexOf(Math.max.apply(window,hSliceWeights.color));
            hMaxSliceEntropy  = hSliceWeights.entropy.indexOf(Math.max.apply(window,hSliceWeights.entropy));
            hMaxSliceWeighted = hSliceWeights.weighted.indexOf(Math.max.apply(window,hSliceWeights.weighted));
            vMaxSliceColor    = vSliceWeights.color.indexOf(Math.max.apply(window,vSliceWeights.color));
            vMaxSliceEntropy  = vSliceWeights.entropy.indexOf(Math.max.apply(window,vSliceWeights.entropy));
            vMaxSliceWeighted = vSliceWeights.weighted.indexOf(Math.max.apply(window,vSliceWeights.weighted));
            var hMaxPercent = (hMaxSliceWeighted+0.5)/settings.slices;
            var vMaxPercent = (vMaxSliceWeighted+0.5)/settings.slices;
            if(settings.debug) {
                console.log(vSliceWeights);
                console.log(hSliceWeights);
                console.log("h max color   : "+hMaxSliceColor   );
                console.log("h max entropy : "+hMaxSliceEntropy );
                console.log("h max weighted: "+hMaxSliceWeighted);
                console.log("v max color   : "+vMaxSliceColor   );
                console.log("v max entropy : "+vMaxSliceEntropy );
                console.log("v max weighted: "+vMaxSliceWeighted);
                console.log("point of interest at: ("+hMaxPercent+", "+vMaxPercent+")")
            }
            $img.data('focusx', hMaxPercent);
            $img.data('focusy', vMaxPercent);
            return([hMaxPercent, vMaxPercent]);
        }
        
        var showPOI = function(canvas, focus) {
            var focusX      = Math.floor(canvas.width*focus[0]);
            var focusY      = Math.floor(canvas.height*focus[1]);
            var context      = canvas.getContext('2d');
            var radius = 10;
            context.beginPath();
            context.arc(focusX, focusY, radius, 0, 2 * Math.PI, false);
            context.fillStyle = 'green';
            context.fill();
            context.lineWidth = 5;
            context.beginPath();
            context.moveTo(focusX, 0);
            context.lineTo(focusX, canvas.height);
            context.strokeStyle = 'green';
            context.stroke();
            context.beginPath();
            context.moveTo(0, focusY);
            context.lineTo(canvas.width, focusY);
            context.strokeStyle = 'green';
            context.stroke();
            return(canvas);
        }
        
        function closest(num, arr) {
            var curr = arr[0];
            var diff = Math.abs(num - curr);
            for(var val = 0; val < arr.length; val++) {
                var newdiff = Math.abs(num - arr[val]);
                if(newdiff < diff) {
                    diff = newdiff;
                    curr = arr[val];
                }
            }
            return curr;
        }
        
        var cropCanvas = function(canvas, width, height, focus) {
            var targetFocus = [closest(focus[0], [.33, .5, .66]), closest(focus[1], [.33, .5, .66])];
            var offsetx = focus[0]*canvas.width - targetFocus[0]*width;
            var offsety = focus[1]*canvas.height - targetFocus[1]*height;
            if(offsetx > canvas.width - width) offsetx = canvas.width - width;
            if(offsetx < 0) offsetx = 0;
            if(offsety > canvas.height - height) offsety = canvas.height - height;
            if(offsety < 0) offsety = 0;
            var canvas2  = Filters.getCanvas(width, height);
            var context  = canvas2.getContext('2d');
            context.clearRect ( 0, 0, width, height);
            context.drawImage(canvas, offsetx, offsety, width, height, 0, 0, width, height);
            return canvas2;
        }
        
        var processIMGHelper = function($img) {
            var imgW    = $img.width();
            var imgH    = $img.height();
            var tempImg = $img.data("tempimg");
            var initialW = tempImg.width;
            var initialH = tempImg.height;
            if(typeof($img.data('maxreduce')) == "undefined")
                $img.data('maxreduce', settings.maxReduce);
            if(!(typeof($img.data("focusx"))=='undefined' || typeof($img.data("focusy")=='undefined'))) {
                var focus = [$img.data("focusx"), $img.data("focusy")];
            } else if(!(settings.focus[0] === null || settings.focus[1] === null)) {
                var focus = settings.focus;
            } else {
                var partialFocus = settings.focus;
                if(!(typeof($img.data("focusx"))=='undefined'))
                    partialFocus[0] = $img.data("focusx");
                if(!(typeof($img.data("focusy"))=='undefined'))
                    partialFocus[1] = $img.data("focusy");
                var canvas   = Filters.getCanvas(initialW, initialH);
                var context  = canvas.getContext('2d');
                context.drawImage(tempImg, 0, 0);
                var focus = findPointOfInterest($img, canvas, partialFocus);
            }
            
            var density = 1;
            if(typeof(window.devicePixelRatio) != "undefined")
                density = window.devicePixelRatio;
            var ratio  = Math.min(Math.max(imgW/initialW, imgH/initialH, $img.data('maxreduce'))*density, 1);
            var canvas = downScaleImage(tempImg, ratio);
            if(settings.debug) {
                canvas     = showPOI(canvas, focus);
            }
            canvas     = cropCanvas(canvas, imgW*density, imgH*density, focus);
            $canvas    = $(canvas);
            $canvas.width(imgW);
            $canvas.height(imgH);
            $img.hide();
            $img.after($canvas);
        }
        
        var processIMG = function($img) {
            var imgsrc = $img.attr('src');
            if(typeof($img.data("tempimg"))!='undefined') {
                processIMGHelper($img);
            } else {
                var tempImg = new Image();
                tempImg.crossOrigin='';
                tempImg.onload = function() {
                    $img.data('tempimg', tempImg);
                    processIMGHelper($img);
                };
                tempImg.src=imgsrc;
            }
        }

        return this.each(function() {
            // this is where my code goes
            var $img = $(this);
            processIMG($img);
            $(window).resize(function() {
                $img.next('canvas').remove();
                $img.show();
                processIMG($img);
            });
        });
    };
}(jQuery));