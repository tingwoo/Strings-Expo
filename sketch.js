// my video size: 640 x 480

let canvas;
let savedCanvas = [];

const numberOfPins = 134; // not multiple of 4
const res = 57; // odd number
const distanceToEdge = 80;
let radius = 300;
let blockLength = (radius * 2) / res;

let miniCanvasSize;
let miniCanvasGap;
let miniCanvasRatio = 0.28;

let buttonSizeRatio = 0.1;

let positionArray;

let blocksInEachLine = [];
let lengthOfEachLine = [];

let video;

let videoPixelPerBlock;
let horizontalRes;
let gap;

let currentCanvas = []; // current block brightness
let currentLines = []; // queue of Lines
let currentPin = 0;

const coef = 1.4;
let totalLines = 5000;

let fr = 0;

let showFrameRate = false;
let showAsciiArt = true;

let draggingHandle = false;
let handleAngle = -Math.PI / 4;
let handleAngleDragging = 0;
let actualAngle;

let targetAngle = -Math.PI / 4;

let timer;

let cutout;
let videoSampleImage;
let displayImage;

let orangeColor;
let bgColor;
let currentShiftDistance = 0;

const miniCanvasColsLimit = 6;
let maxMiniCanvasCols;

let activeValue = 1;
let lastVideoValue = [new Array(res).fill(255), new Array(res).fill(255)];

const PI3 = Math.PI / 3;
const PI4 = Math.PI / 4;
let irisState = Math.PI / 3;

function getColorFromPixel(x, y) {
    const w = video.width;
    const i = (y * w + x) * 4;
    return [
        video.pixels[i],
        video.pixels[i + 1],
        video.pixels[i + 2],
        video.pixels[i + 3],
    ];
}

function filt(bri) {
    const high = 235;
    const low = 55;
    if (bri < low) return 0;
    else if (bri <= high) return (bri - low) * (255 / (high - low));
    return 255;
}

function getVector(first, second) {
    const slope = (first[1] - second[1]) / (first[0] - second[0]);
    if (Math.abs(slope) <= 1) {
        return first[0] - second[0] <= 0 ? [1, slope] : [-1, slope];
    } else {
        return first[1] - second[1] <= 0 ? [1 / slope, 1] : [1 / slope, -1];
    }
}

function blockToPixel(coord) {
    const x = (coord[0] + 0.5) * ((radius * 2) / res);
    const y = (coord[1] + 0.5) * ((radius * 2) / res);
    return [x, y];
}

function pixelToBlock(coord) {
    const x = coord[0] / ((radius * 2) / res) - 0.5;
    const y = coord[1] / ((radius * 2) / res) - 0.5;
    return [x, y];
}

function pixelToBlockDiscrete(coord) {
    const x = Math.round(coord[0] / ((radius * 2) / res) - 0.5);
    const y = Math.round(coord[1] / ((radius * 2) / res) - 0.5);
    return [x, y];
}

function getLineBlocks(first, second) {
    if (first === second) return [];
    if (first > second) return blocksInEachLine[second][first - second - 1];
    return blocksInEachLine[first][second - first - 1];
}

function getVideoSample(x, y) {
    const c = getColorFromPixel(
        (horizontalRes - x - gap) * videoPixelPerBlock,
        y * videoPixelPerBlock
    );
    return filt(brightness(c) * 2.55);
}

function diffFormula(canvas, truth) {
    // if(canvas > truth) {
    //   return 2 * (canvas - truth);
    // }
    // return truth - canvas;
    return Math.abs(truth - canvas);
}

// https://www.desmos.com/calculator/bycvo6oueu
function handleCurveSub(x) {
    return x / (3.5 * x + 1);
}

function handleCurve(x) {
    if (x < -PI4) {
        return -handleCurveSub(-x - PI4) - PI4;
    } else if (x < PI4) {
        return x;
    } else {
        return handleCurveSub(x - PI4) + PI4;
    }
}

function resetTimer() {
    timer = millis();
    console.log("reset");
}

function timerCkpt() {
    console.log(millis() - timer);
    timer = millis();
}

function handleMap(angle, a, b, elastic) {
    if (elastic) return map(angle, -PI4, PI4, a, b);
    return constrain(map(angle, -PI4, PI4, a, b), a, b);
}

const characterSet = [
    " ',.`',.",
    ';:-";:-"',
    "?=+~<>!l",
    "/\\(){}[]",
    "zcvunxrt",
    "ZOLCJUYX",
    "oahkbdwm",
    "$@B%&WM#",
];

function characterMap(bri) {
    return characterSet[Math.floor(bri / 32)][Math.floor(Math.random() * 8)];
}

function drawCross(c, width) {
    line(
        c[0] - width * 0.5,
        c[1] - width * 0.5,
        c[0] + width * 0.5,
        c[1] + width * 0.5
    );
    line(
        c[0] - width * 0.5,
        c[1] + width * 0.5,
        c[0] + width * 0.5,
        c[1] - width * 0.5
    );
}

function irisArcFunc(angle) {
    const a = 1 - Math.cos(angle);
    const b = Math.sin(angle);
    const c = 1 / Math.sqrt(2) - Math.cos(angle - PI * 0.25);
    const d = 1 / Math.sqrt(2) + Math.sin(angle - PI * 0.25);

    const dist = sqrt(sq(a - c) + sq(b - d));
    const a0 = Math.acos(dist * 0.5);

    const vec1 = [Math.cos(PI * 0.25 - angle), Math.sin(PI * 0.25 - angle)];
    const vec2 = [a - c, b - d];
    const a1 = Math.acos((vec1[0] * vec2[0] + vec1[1] * vec2[1]) / dist);

    const vec3 = [-Math.cos(angle), Math.sin(angle)];
    const vec4 = [c - a, d - b];
    const a2 = Math.acos((vec3[0] * vec4[0] + vec3[1] * vec4[1]) / dist);

    return [angle > PI * 0.25 ? a0 - a1 : a0 + a1, PI - a0 - a2];
}

function rotateAround(cx, cy, x, y, angle) {
    const dx = x - cx;
    const dy = y - cy;
    const ndx = Math.cos(angle) * dx - Math.sin(angle) * dy;
    const ndy = Math.sin(angle) * dx + Math.cos(angle) * dy;
    return [cx + ndx, cy + ndy];
}

let font;

function preload() {
    font = loadFont("assets/VictorMono-Medium.otf");
}

function setup() {
    canvas = createCanvas(windowWidth, windowHeight);

    radius = min(
        (width - 2 * distanceToEdge) * 0.5,
        (height - 2 * distanceToEdge) * 0.5
    );
    blockLength = (radius * 2) / res;
    positionArray = Array.from(Array(numberOfPins).keys()).map((v) => {
        return [
            radius * (1 + 0.99 * cos(((2 * v) / numberOfPins) * Math.PI)),
            radius * (1 + 0.99 * sin(((2 * v) / numberOfPins) * Math.PI)),
        ];
    });

    miniCanvasSize = Math.round(2 * radius * miniCanvasRatio);
    miniCanvasGap = 2 * radius * (1 - 3 * miniCanvasRatio) * 0.5;

    video = createCapture(VIDEO);

    // generate covered blocks for all possible lines
    for (let i = 0; i < numberOfPins - 1; i++) {
        const start = pixelToBlock(positionArray[i]);
        blocksInEachLine.push([]);
        for (let j = i + 1; j < numberOfPins; j++) {
            const end = pixelToBlock(positionArray[j]);
            const slope = (end[1] - start[1]) / (end[0] - start[0]);
            let blockArray = [];

            if (Math.abs(slope) <= 1) {
                const vector = end[0] > start[0] ? [1, slope] : [-1, -slope];
                let currentX = Math.round(start[0]);
                let currentY =
                    start[1] + slope * (Math.round(start[0]) - start[0]);
                const endX = Math.round(end[0]);

                while (currentX - vector[0] != endX) {
                    blockArray.push([currentX, Math.round(currentY)]);
                    currentX += vector[0];
                    currentY += vector[1];
                }
            } else {
                const vector =
                    end[1] > start[1] ? [1 / slope, 1] : [-1 / slope, -1];
                let currentY = Math.round(start[1]);
                let currentX =
                    start[0] + (1 / slope) * (Math.round(start[1]) - start[1]);
                const endY = Math.round(end[1]);

                while (currentY - vector[1] != endY) {
                    blockArray.push([Math.round(currentX), currentY]);
                    currentX += vector[0];
                    currentY += vector[1];
                }
            }
            blocksInEachLine[i].push(blockArray);
        }
    }

    // initialize currentCanvas to all black
    resetCurrentCanvas();

    // initialize lengthOfEachLine
    for (let i = 0; i < numberOfPins; i++) {
        lengthOfEachLine.push(
            dist(
                positionArray[0][0],
                positionArray[0][1],
                positionArray[i][0],
                positionArray[i][1]
            ) /
                (radius * 2)
        );
    }

    video.hide();

    cutout = createGraphics(600, 600);
    videoSampleImage = createGraphics(600, 600);
    displayImage = createGraphics(600, 600);

    orangeColor = color(255, 79, 0);
    bgColor = color(20);
}

function draw() {
    // resetTimer();
    // timerCkpt();
    background(bgColor);

    if (frameCount % 5 === 0) {
        video.loadPixels(); // takes a lot of time
    }

    frameRate(60);
    // timerCkpt();

    actualAngle = handleCurve(handleAngle + handleAngleDragging);

    translate(
        width * 0.5 - radius - currentShiftDistance,
        height * 0.5 - radius
    );
    // translate(handleMap(actualAngle, 0, -radius * distanceBetweenCenters * 0.5, true), 0);

    videoPixelPerBlock = Math.floor(video.height / res);
    horizontalRes = Math.floor((res * video.width) / video.height);
    gap = Math.floor(res * (video.width / video.height - 1) * 0.5);

    let videoSample = [];
    videoSampleImage.blendMode(BLEND);
    videoSampleImage.noStroke();

    for (let i = 0; i < res; i++) {
        videoSample.push([]);
        for (let j = 0; j < res; j++) {
            videoSample[i].push(getVideoSample(i, j));
        }
    }

    // draw pixels
    if (frameCount % 5 === 0) {
        videoSampleImage.background(bgColor);
        videoSampleImage.textAlign(CENTER, CENTER);
        const alpha = constrain(map(irisState, PI3 - 0.8, PI3, 255, 0), 0, 255);
        for (let i = 0; i < res; i++) {
            let sum = 0;
            for (let j = 0; j < res; j++) {
                sum += videoSample[j][i];
                if (!showAsciiArt) {
                    videoSampleImage.fill(videoSample[j][i]);
                    videoSampleImage.rect(
                        j * (600 / res),
                        i * (600 / res),
                        (600 / res) * 1.05,
                        (600 / res) * 1.05
                    );
                } else {
                    videoSampleImage.fill(255, alpha);
                    videoSampleImage.textFont(font, 12);
                    videoSampleImage.text(
                        characterMap(videoSample[j][i]),
                        (j + 0.5) * (600 / res),
                        (i + 0.5) * (600 / res)
                    );
                }
            }
            lastVideoValue[(frameCount / 5) % 2][i] = sum;
        }

        // increase activeness
        let diff = 0;
        for (let i = 0; i < res; i++) {
            const d = lastVideoValue[0][i] - lastVideoValue[1][i];
            diff += d * d;
            12;
        }
        diff = sqrt(diff / res);
        activeValue = activeValue + (diff / 255) * 0.05;
    }

    // decrease activeness
    activeValue = constrain(activeValue - 0.0015, 0, 1);

    // change iris state
    if (activeValue > 0.5) {
        irisState -= (irisState * (PI3 - irisState + 0.01)) / 10;
    } else {
        irisState += ((PI3 - irisState) * (irisState + 0.01)) / 10;
    }

    // reset canvas value regularly
    if(frameCount % 1800 == 0 && irisState > PI3 - 0.001) {
        currentLines = [];
        resetCurrentCanvas();
    }

    // timerCkpt();
    if (irisState < PI3 - 0.001) {
        for (let k = 0; k < 50; k++) {
            // find the best line
            let bestScore = -100000000;
            let bestLine = [];
            let bestValuePerBlock;
            for (
                let i1 = currentPin + 15;
                i1 <= currentPin + numberOfPins - 15;
                i1 += Math.floor(Math.random() * 4) + 1
            ) {
                const i = i1 % numberOfPins;

                if (
                    currentLines.length > 0 &&
                    i === currentLines[currentLines.length - 1][0]
                )
                    continue;

                const blocks = getLineBlocks(currentPin, i);
                const lineTotalValue =
                    coef * res * lengthOfEachLine[Math.abs(currentPin - i)];
                const valuePerBlock = lineTotalValue / blocks.length;
                let score = 0;

                blocks.forEach((e) => {
                    const canvasV = currentCanvas[e[0]][e[1]];
                    const actualV = videoSample[e[0]][e[1]];
                    score +=
                        diffFormula(canvasV, actualV) -
                        diffFormula(canvasV + valuePerBlock, actualV); // old difference - new difference
                });

                // score /= lengthOfEachLine[Math.abs(currentPin - i)];

                if (score > bestScore) {
                    bestScore = score;
                    bestLine = [currentPin, i];
                    bestValuePerBlock = valuePerBlock;
                }
            }

            // add best line to queue
            if (bestScore > 0) {
                currentLines.push(bestLine);
                const blocks = getLineBlocks(bestLine[0], bestLine[1]);
                blocks.forEach((e) => {
                    currentCanvas[e[0]][e[1]] += bestValuePerBlock;
                });
                currentPin = bestLine[1];
                totalLines += 1;
                totalLines = Math.min(5000, totalLines);
            } else {
                totalLines = Math.max(0, totalLines - 50);
                break;
            }
        }

        // timerCkpt();

        // remove first lines in queue
        if (currentLines.length > totalLines) {
            const removedLines = currentLines.splice(
                0,
                currentLines.length - totalLines
            );

            removedLines.forEach((line) => {
                const blocks = getLineBlocks(line[0], line[1]);
                const lineTotalValue =
                    coef * res * lengthOfEachLine[Math.abs(line[0] - line[1])];
                const valuePerBlock = lineTotalValue / blocks.length;
                blocks.forEach((e) => {
                    currentCanvas[e[0]][e[1]] -= valuePerBlock; // old difference - new difference
                });
            });
        }

        // timerCkpt();

        // show strings
        if (handleMap(actualAngle, 0, 255, true) < 254.9) {
            // draw all lines in the queue
            stroke(
                255,
                constrain(map(irisState, PI3 - 0.8, PI3, 15, 0), 0, 15)
            );
            strokeWeight(radius * 0.0025);
            currentLines.forEach((e) => {
                line(
                    positionArray[e[0]][0],
                    positionArray[e[0]][1],
                    positionArray[e[1]][0],
                    positionArray[e[1]][1]
                );
            });

            // draw pins
            fill(255);
            noStroke();
            for (let i = 0; i < numberOfPins; i++) {
                ellipse(positionArray[i][0], positionArray[i][1], 3, 3);
            }
        }

        // show video sample
        if (handleMap(actualAngle, 0, 255, true) > 0.1) {
            cutout.clear();
            cutout.blendMode(BLEND);
            cutout.background(255);
            cutout.blendMode(REMOVE);
            cutout.noStroke();
            cutout.fill(0, handleMap(actualAngle, 0, 255, false));
            cutout.circle(300, 300, 600);

            displayImage.blendMode(BLEND);
            displayImage.image(videoSampleImage, 0, 0);
            displayImage.blendMode(REMOVE);
            displayImage.image(cutout, 0, 0);

            image(displayImage, 0, 0, 2 * radius, 2 * radius);
        }
    }

    // show info
    if (showFrameRate) {
        if (frameCount % 30 === 0) {
            fr = frameRate();
        }
        fill(240);
        noStroke();
        text("Frame rate: " + str(Math.round(fr)), 5, 20);
        text("Activeness: " + str(activeValue.toFixed(2)), 5, 40);
        text(str(video.width) + " x " + str(video.height), 5, 60);
    }

    // draw handle
    stroke(orangeColor);
    strokeWeight(2);
    noFill();
    const handlePos = [radius * cos(actualAngle), radius * sin(actualAngle)];
    line(
        radius + handlePos[0] * 1.02,
        radius + handlePos[1] * 1.02,
        radius + handlePos[0] * 1.07,
        radius + handlePos[1] * 1.07
    );
    arc(
        radius,
        radius,
        radius * 1.02 * 2,
        radius * 1.02 * 2,
        actualAngle - 0.3,
        actualAngle + 0.3
    );
    fill(bgColor);
    if (mouseIsNearHandle() || draggingHandle)
        circle(
            radius + handlePos[0] * 1.07,
            radius + handlePos[1] * 1.07,
            radius * 0.03
        );

    // draw iris
    if (irisState > 0.001) {
        const arcRotateAngle = irisState;
        const arcLengths = irisArcFunc(arcRotateAngle);
        const irisR = radius * 0.99;
        translate(radius, radius);
        fill(bgColor);
        strokeWeight(2);
        stroke(255, constrain(map(irisState, 0, 0.1, 0, 255), 0, 255));

        for (let i = 0; i < TWO_PI - 0.001; i += TWO_PI / 8) {
            const arcStartPos1 = [irisR * cos(i - PI4), irisR * sin(i - PI4)];
            const arcStartPos2 = [irisR * cos(i), irisR * sin(i)];
            const arcCenter1 = [
                arcStartPos1[0] + irisR * cos(PI + i - PI4 + arcRotateAngle),
                arcStartPos1[1] + irisR * sin(PI + i - PI4 + arcRotateAngle),
            ];
            const arcCenter2 = [
                arcStartPos2[0] + irisR * cos(PI + i + arcRotateAngle),
                arcStartPos2[1] + irisR * sin(PI + i + arcRotateAngle),
            ];

            beginShape();
            for (let j = 0; j < arcLengths[0]; j += 0.05) {
                vertex(
                    arcCenter1[0] + irisR * cos(arcRotateAngle + i - PI4 + j),
                    arcCenter1[1] + irisR * sin(arcRotateAngle + i - PI4 + j)
                );
            }

            for (let j = arcLengths[1]; j > 0; j -= 0.05) {
                vertex(
                    arcCenter2[0] + irisR * cos(arcRotateAngle + i + j),
                    arcCenter2[1] + irisR * sin(arcRotateAngle + i + j)
                );
            }

            for (let j = 0; j < PI * 0.25; j += 0.05) {
                vertex(irisR * cos(i - j), irisR * sin(i - j));
            }
            endShape(CLOSE);
        }
        translate(-radius, -radius);
    }

    // draw capture button
    if (maxMiniCanvasCols > 0) {
        const buttonCenter = getCaptureButtonCenter();
        const buttonRadius = radius * buttonSizeRatio;
        const iconCornerDist = buttonRadius * 0.25;
        const iconCornerSize = buttonRadius * 0.4;
        if (
            irisState < 0.001 &&
            mouseIsOnButton(getCaptureButtonCenter(), radius * buttonSizeRatio)
        )
            fill(60);
        else fill(bgColor);

        strokeWeight(2);
        stroke(255);
        circle(buttonCenter[0], buttonCenter[1], buttonRadius * 2);
        for (let i = 0; i < 4; i++) {
            const rotateSign = rotateAround(0, 0, -1, -1, i * HALF_PI);
            arc(
                buttonCenter[0] + rotateSign[0] * iconCornerDist,
                buttonCenter[1] + rotateSign[1] * iconCornerDist,
                iconCornerSize,
                iconCornerSize,
                Math.PI * (i * 0.5 + 1) - 0.05,
                Math.PI * (i * 0.5 + 1.5) + 0.05
            );
        }
    }

    if (actualAngle < 0) {
        targetAngle = -PI4;
    } else {
        targetAngle = PI4;
    }

    // reset handle
    if (!draggingHandle) {
        handleAngle -=
            ((handleAngle - targetAngle) / (Math.PI * 0.5) / 8) *
            (deltaTime * 0.06);
    }

    // translate animation
    currentShiftDistance +=
        (shiftDistance() - currentShiftDistance) * (deltaTime * 0.005);

    // show gallery
    updateMaxMiniCanvasCols();
    strokeWeight(2);
    stroke(255);
    noFill();

    let startCanvasPosition = 0;
    if (savedCanvas.length > maxMiniCanvasCols * 3) {
        startCanvasPosition = savedCanvas.length - maxMiniCanvasCols * 3;
    }

    savedCanvas.forEach((v, i) => {
        if (i >= savedCanvas.length - maxMiniCanvasCols * 3) {
            let i1 = i - startCanvasPosition;
            if (i === savedCanvas.length - 1) stroke(orangeColor);

            const posCorner = miniCanvasPosition(
                i1,
                min(maxMiniCanvasCols * 3, savedCanvas.length)
            );
            const posCenter = [
                posCorner[0] + 0.5 * miniCanvasSize,
                posCorner[1] + 0.5 * miniCanvasSize,
            ];
            image(
                v,
                posCorner[0],
                posCorner[1],
                miniCanvasSize,
                miniCanvasSize
            );
            circle(posCenter[0], posCenter[1], miniCanvasSize);
            if (mouseIsOnButton(posCenter, 0.5 * miniCanvasSize)) {
                stroke(255);
                drawCross(posCenter, miniCanvasSize * 0.9);
            }
        }
    });

    // timerCkpt();
}

function captureCanvas() {
    // copy main canvas
    let tmpCanvas = createGraphics(miniCanvasSize, miniCanvasSize);
    tmpCanvas.copy(
        canvas,
        (width - 2 * radius) * 0.5 - currentShiftDistance,
        (height - 2 * radius) * 0.5,
        2 * radius,
        2 * radius,
        0,
        0,
        miniCanvasSize,
        miniCanvasSize
    );
    if (savedCanvas.length === miniCanvasColsLimit * 3) savedCanvas.shift();

    // use four triangles to cover capture button & info panel
    tmpCanvas.fill(bgColor);
    tmpCanvas.noStroke();
    for (let i = 0; i < 4; i++) {
        const centerL = miniCanvasSize * 0.5;
        const sideL = miniCanvasSize * (1 - Math.sqrt(0.5));
        const p1 = rotateAround(centerL, centerL, 0, 0, i * HALF_PI);
        const p2 = rotateAround(centerL, centerL, 0, sideL, i * HALF_PI);
        const p3 = rotateAround(centerL, centerL, sideL, 0, i * HALF_PI);
        tmpCanvas.triangle(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
    }
    savedCanvas.push(tmpCanvas);
}

function miniCanvasPosition(index, total) {
    const sumLen = miniCanvasSize + miniCanvasGap;
    return [
        (Math.floor(index / 3) - Math.floor((total - 1) / 3) - 1) * sumLen,
        (index % 3) * sumLen,
    ];
}

function shiftDistance() {
    let tmp = Math.floor((savedCanvas.length - 1) / 3) + 1;

    return (
        -min(tmp, maxMiniCanvasCols) * (miniCanvasSize + miniCanvasGap) * 0.5
    );
}

function updateMaxMiniCanvasCols() {
    for (let i = miniCanvasColsLimit; i > 0; i--) {
        const left = width - radius * 2 - (miniCanvasSize + miniCanvasGap) * i;
        if (left >= distanceToEdge * 2) {
            maxMiniCanvasCols = i;
            return;
        }
    }
    maxMiniCanvasCols = 0;
}

function getCaptureButtonCenter() {
    return [
        radius * (buttonSizeRatio + 0.07),
        radius * (2 - buttonSizeRatio - 0.07),
    ];
}

function mouseIsOnButton(c, r) {
    return (
        dist(
            mouseX - (width * 0.5 - radius - currentShiftDistance),
            mouseY - (height * 0.5 - radius),
            c[0],
            c[1]
        ) < r
    );
}

function getHandleCenter() {
    return [
        radius * (1 + 1.07 * cos(actualAngle)),
        radius * (1 + 1.07 * sin(actualAngle)),
    ];
}

function mouseIsNearHandle() {
    const handleCenter = getHandleCenter();
    return (
        dist(
            mouseX - (width * 0.5 - radius - currentShiftDistance),
            mouseY - (height * 0.5 - radius),
            handleCenter[0],
            handleCenter[1]
        ) <
        radius * 0.2
    );
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    radius = min(
        (width - 2 * distanceToEdge) * 0.5,
        (height - 2 * distanceToEdge) * 0.5
    );
    blockLength = (radius * 2) / res;

    miniCanvasSize = Math.round(2 * radius * miniCanvasRatio);
    miniCanvasGap = 2 * radius * (1 - 3 * miniCanvasRatio) * 0.5;

    positionArray = Array.from(Array(numberOfPins).keys()).map((v) => {
        return [
            radius * (1 + 0.99 * cos(((2 * v) / numberOfPins) * Math.PI)),
            radius * (1 + 0.99 * sin(((2 * v) / numberOfPins) * Math.PI)),
        ];
    });
}

function keyTyped() {
    if (key === "f" || key === "F") showFrameRate = !showFrameRate;
    else if (key === "a" || key === "A") showAsciiArt = !showAsciiArt;
    else if (key === "c" || key === "C") captureCanvas();
}

function mousePressed() {
    draggingHandle = true;
    mouseStartPosition = [mouseX, mouseY];
}

function mouseReleased() {
    draggingHandle = false;
    handleAngle += handleAngleDragging;
    handleAngleDragging = 0;

    if (
        maxMiniCanvasCols > 0 &&
        irisState < 0.001 &&
        mouseIsOnButton(getCaptureButtonCenter(), radius * buttonSizeRatio)
    ) {
        captureCanvas();
        return;
    }

    let startCanvasPosition = 0;
    if (savedCanvas.length > maxMiniCanvasCols * 3) {
        startCanvasPosition = savedCanvas.length - maxMiniCanvasCols * 3;
    }

    savedCanvas.forEach((v, i) => {
        if (i >= savedCanvas.length - maxMiniCanvasCols * 3) {
            let i1 = i - startCanvasPosition;
            if (i === savedCanvas.length - 1) stroke(orangeColor);

            const posCorner = miniCanvasPosition(
                i1,
                min(maxMiniCanvasCols * 3, savedCanvas.length)
            );
            const posCenter = [
                posCorner[0] + 0.5 * miniCanvasSize,
                posCorner[1] + 0.5 * miniCanvasSize,
            ];
            circle(posCenter[0], posCenter[1], miniCanvasSize);
            if (mouseIsOnButton(posCenter, 0.5 * miniCanvasSize)) {
                savedCanvas.splice(i, 1);
            }
        }
    });
}

function mouseDragged() {
    handleAngleDragging = map(
        mouseY - mouseStartPosition[1],
        -height * 0.5,
        height * 0.5,
        -HALF_PI,
        HALF_PI
    );
}

function resetCurrentCanvas() {
    currentCanvas = [];
    for (let i = 0; i < res; i++) {
        currentCanvas.push([]);
        for (let j = 0; j < res; j++) {
            currentCanvas[i].push(0);
        }
    }
}