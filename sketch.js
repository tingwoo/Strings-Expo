// my video size: 640 x 480

let canvas;
let savedCanvas = [];

let numberOfPins = 134; // not multiple of 4
let radius = 300;
let res = 57; // odd number
let blockLength = radius * 2 / res;
let distanceToEdge = 80;

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
let currentLines = [];  // queue of Lines
let currentPin = 0;

let coef = 1.5;
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

let maxMiniCanvasRows;

function getColorFromPixel(x, y) {
  let w = video.width;
  let i = (y*w+x)*4;
  return [video.pixels[i], video.pixels[i+1], video.pixels[i+2], video.pixels[i+3]];
}

function filt(bri) {
  let high = 235;
  let low = 55;
  if(bri < low) {
    return 0;
  } else if(bri <= high) {
    return (bri - low) * (255 / (high - low));
  } 
  return 255;
}

function getVector(first, second) {
  let slope = (first[1] - second[1]) / (first[0] - second[0]);
  if(Math.abs(slope) <= 1) {
    return (first[0] - second[0] <= 0) ? [1, slope] : [-1, slope];
  } else {
    return (first[1] - second[1] <= 0) ? [1/slope, 1] : [1/slope, -1];
  }
}

function blockToPixel(coord) {
  let x = (coord[0] + 0.5) * (radius * 2 / res);
  let y = (coord[1] + 0.5) * (radius * 2 / res);
  return [x, y];
}

function pixelToBlock(coord) {
  let x = coord[0] / (radius * 2 / res) - 0.5;
  let y = coord[1] / (radius * 2 / res) - 0.5;
  return [x, y];
}

function pixelToBlockDiscrete(coord) {
  let x = Math.round(coord[0] / (radius * 2 / res) - 0.5);
  let y = Math.round(coord[1] / (radius * 2 / res) - 0.5);
  return [x, y];
}

function getLineBlocks(first, second){
  if(first === second) return [];
  if(first > second) return blocksInEachLine[second][first - second - 1];
  return blocksInEachLine[first][second - first - 1];
}

function getVideoSample(x, y) {
  let c = getColorFromPixel((horizontalRes-x-gap)*videoPixelPerBlock, y*videoPixelPerBlock);
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
  if (x < -Math.PI / 4) {
    return -handleCurveSub(-x-Math.PI/4) - Math.PI/4;
  } else if (x < Math.PI / 4) {
    return x;
  } else {
    return handleCurveSub(x-Math.PI/4) + Math.PI/4;
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
  if(elastic) { return map(angle, -Math.PI / 4, Math.PI / 4, a, b); }
  return constrain(map(angle, -Math.PI / 4, Math.PI / 4, a, b), a, b);
}

let characterSet = [" ',.`',.", ";:-\";:-\"", "?=+~<>!l", "/\\(){}[]", "zcvunxrt", "ZOLCJUYX", "oahkbdwm", "$@B%&WM#"]
// let characters = " `.-':_,^=;><+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@"
function characterMap(bri) {
  // return characters[Math.floor(bri / 256 * 92)]
  return characterSet[Math.floor(bri/32)][Math.floor(Math.random() * 8)];
}

function drawCross(c, width) {
  line(c[0] - width / 2, c[1] - width / 2, c[0] + width / 2, c[1] + width / 2);
  line(c[0] - width / 2, c[1] + width / 2, c[0] + width / 2, c[1] - width / 2);
}

let font;

function preload() {
  font = loadFont('assets/VictorMono-Medium.otf');
}

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  
  radius = min((width - 2 * distanceToEdge) / 2, (height - 2 * distanceToEdge) / 2);
  blockLength = radius * 2 / res;
  positionArray = Array.from(Array(numberOfPins).keys()).map((v) => {
    return [radius * (1 + 0.99*cos(2*v/numberOfPins*Math.PI)), radius * (1 + 0.99*sin(2*v/numberOfPins*Math.PI))]
  });

  miniCanvasSize = Math.round(2 * radius * miniCanvasRatio);
  miniCanvasGap = 2 * radius * (1-3*miniCanvasRatio)/2;

  video = createCapture(VIDEO);

  // generate covered blocks for all possible lines
  for(let i = 0; i < numberOfPins-1; i++) {
    let start = pixelToBlock(positionArray[i]);
    blocksInEachLine.push([]);
    for(let j = i+1; j < numberOfPins; j++) {
      let end = pixelToBlock(positionArray[j]);
      let slope = (end[1] - start[1]) / (end[0] - start[0]);
      let blockArray = [];

      if(Math.abs(slope) <= 1) {
        let vector = end[0] > start[0] ? [1, slope] : [-1, -slope];
        let currentX = Math.round(start[0]);
        let currentY = start[1] + slope * (Math.round(start[0]) - start[0]);
        let endX = Math.round(end[0]);
        
        while(currentX - vector[0] != endX) { 
          blockArray.push([currentX, Math.round(currentY)]);
          currentX += vector[0];
          currentY += vector[1];    
        }
      } else {
        let vector = end[1] > start[1] ? [1/slope, 1] : [-1/slope, -1];
        let currentY = Math.round(start[1]);
        let currentX = start[0] + (1/slope) * (Math.round(start[1]) - start[1]);
        let endY = Math.round(end[1]);
        
        while(currentY - vector[1] != endY) { 
          blockArray.push([Math.round(currentX), currentY]);
          currentX += vector[0];
          currentY += vector[1];    
        }
      }
      blocksInEachLine[i].push(blockArray);
    }
  }

  // initialize currentCanvas to all white
  for(let i = 0; i < res; i++) {
    currentCanvas.push([]);
    for(let j = 0; j < res; j++) {
      currentCanvas[i].push(0);
    }
  }

  // initialize lengthOfEachLine
  for(let i = 0; i < numberOfPins; i++){
    lengthOfEachLine.push(dist(positionArray[0][0], positionArray[0][1], positionArray[i][0], positionArray[i][1]) / radius / 2)
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

  if(frameCount % 5 === 0) { 
    video.loadPixels(); // takes a lot of time
  }

  frameRate(60);
  // timerCkpt();

  actualAngle = handleCurve(handleAngle + handleAngleDragging);

  translate(width/2-radius - currentShiftDistance, height/2-radius);
  // translate(handleMap(actualAngle, 0, -radius * distanceBetweenCenters / 2, true), 0);

  videoPixelPerBlock = Math.floor(video.height / res);
  horizontalRes = Math.floor(res * video.width / video.height);
  gap = Math.floor((res * (video.width / video.height - 1)) / 2);

  let videoSample = [];
  videoSampleImage.blendMode(BLEND);
  videoSampleImage.noStroke();

  for(let i = 0; i < res; i++){
    videoSample.push([]);
    for(let j = 0; j < res; j++){
      let sample = getVideoSample(i, j);
      videoSample[i].push(sample);
    }
  }

  if(frameCount % 5 === 0) {
    videoSampleImage.background(bgColor);
    videoSampleImage.textAlign(CENTER, CENTER);
    for(let i = 0; i < res; i++){
      for(let j = 0; j < res; j++){
        if(!showAsciiArt) {
          videoSampleImage.fill(videoSample[j][i]);
          videoSampleImage.rect(j*(600/res), i*(600/res), 600/res*1.05, 600/res*1.05);
        } else {
          videoSampleImage.fill(255);
          videoSampleImage.textFont(font, 12);
          videoSampleImage.text(characterMap(videoSample[j][i]), (j+0.5)*(600/res), (i+0.5)*(600/res));
        }
      }
    }
  }

  // timerCkpt();

  for(let k = 0; k < 50; k++) {
    // find the best line
    let bestScore = -100000000;
    let bestLine = [];
    let bestValuePerBlock;
    for(let i1 = currentPin + 15; i1 <= currentPin + numberOfPins - 15; i1 += (Math.floor(Math.random() * 4) + 1)) {
      
      let i = i1 % numberOfPins;

      if(currentLines.length > 0 && i === currentLines[currentLines.length - 1][0]) continue;

      let blocks = getLineBlocks(currentPin, i);
      let lineTotalValue = coef * res * lengthOfEachLine[Math.abs(currentPin - i)];
      let valuePerBlock = lineTotalValue / blocks.length;
      let score = 0;

      blocks.forEach(e => {
        let canvas = currentCanvas[e[0]][e[1]];
        let truth = videoSample[e[0]][e[1]];
        score += diffFormula(canvas, truth) - diffFormula(canvas + valuePerBlock, truth); // old difference - new difference
      });

      if(score > bestScore) {
        bestScore = score;
        bestLine = [currentPin, i];
        bestValuePerBlock = valuePerBlock;
      }
    }

    // add best line to queue
    if(bestScore > 0){
      currentLines.push(bestLine);
      let blocks = getLineBlocks(bestLine[0], bestLine[1]);
      blocks.forEach(e => {
        currentCanvas[e[0]][e[1]] += bestValuePerBlock;
      });
      currentPin = bestLine[1]; 
      totalLines += 1;
      totalLines = Math.min(5000, totalLines);
    } else {
      totalLines -= 50;
      totalLines = Math.max(0, totalLines);
      break;
    }
  }

  // timerCkpt();

  // remove first lines in queue
  if(currentLines.length > totalLines) {
    let removedLines = currentLines.splice(0, currentLines.length - totalLines);

    removedLines.forEach(line => {
      let blocks = getLineBlocks(line[0], line[1]);
      let lineTotalValue = coef * res * lengthOfEachLine[Math.abs(line[0] - line[1])];
      let valuePerBlock = lineTotalValue / blocks.length;

      blocks.forEach(e => {
        currentCanvas[e[0]][e[1]] -= valuePerBlock; // old difference - new difference 
      });
    });
  }

  // timerCkpt();

  // show strings
  if(handleMap(actualAngle, 0, 255, true) < 254.9) {
    // draw all lines in the queue
    stroke(255, 15);
    strokeWeight(radius * 0.0025);
    currentLines.forEach(e => {
      line(positionArray[e[0]][0], positionArray[e[0]][1], positionArray[e[1]][0], positionArray[e[1]][1]);
    });
    
    // draw pins
    fill(255);
    noStroke();
    for(let i = 0; i < numberOfPins; i++) {
      ellipse(positionArray[i][0], positionArray[i][1], 3, 3);
    }
  }

  // show video sample
  if(handleMap(actualAngle, 0, 255, true) > 0.1) {
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
    
    image(displayImage, 0, 0, 2*radius, 2*radius);
  }

  // show info
  if(showFrameRate) {
    if(frameCount % 30 === 0) {
      fr = frameRate();
    }
    fill(240);
    noStroke();
    text("Frame rate: " + str(Math.round(fr)), 5, 20);

    text(str(video.width) + " x " + str(video.height), 5, 40);
  }

  // draw handle
  stroke(orangeColor);
  strokeWeight(2);
  noFill();
  let handlePos = [radius * cos(actualAngle), radius * sin(actualAngle)];
  line(radius + handlePos[0] * 1.02, radius + handlePos[1] * 1.02, radius + handlePos[0] * 1.07, radius + handlePos[1] * 1.07)
  arc(radius, radius, radius * 1.02 * 2, radius * 1.02 * 2, actualAngle - 0.3, actualAngle + 0.3);
  fill(bgColor);
  if(mouseIsNearHandle() || draggingHandle) circle(radius + handlePos[0] * 1.07, radius + handlePos[1] * 1.07, radius * 0.03);

  // draw capture button
  if(maxMiniCanvasRows > 0) {
    let buttonCenter = getCaptureButtonCenter();
    let buttonRadius = radius * buttonSizeRatio;
    let iconCornerDist = buttonRadius * 0.25;
    let iconCornerSize = buttonRadius * 0.4;
    if(mouseIsOnButton(getCaptureButtonCenter(), radius * buttonSizeRatio)){
      fill(60);
    }
    circle(buttonCenter[0], buttonCenter[1], buttonRadius*2);
    arc(buttonCenter[0]-iconCornerDist, buttonCenter[1]-iconCornerDist, iconCornerSize, iconCornerSize, Math.PI*1.0-0.05, Math.PI*1.5+0.05);
    arc(buttonCenter[0]+iconCornerDist, buttonCenter[1]-iconCornerDist, iconCornerSize, iconCornerSize, Math.PI*1.5-0.05, Math.PI*0.0+0.05);
    arc(buttonCenter[0]+iconCornerDist, buttonCenter[1]+iconCornerDist, iconCornerSize, iconCornerSize, Math.PI*0.0-0.05, Math.PI*0.5+0.05);
    arc(buttonCenter[0]-iconCornerDist, buttonCenter[1]+iconCornerDist, iconCornerSize, iconCornerSize, Math.PI*0.5-0.05, Math.PI*1.0+0.05);
  }

  if(actualAngle < 0) { targetAngle = -Math.PI / 4; }
  else { targetAngle = Math.PI / 4; }

  // reset handle
  if(!draggingHandle) {
    handleAngle -= (handleAngle - targetAngle) / (Math.PI / 2) / 8 * (deltaTime * 0.06);
  }

  // translate animation
  currentShiftDistance += (shiftDistance() - currentShiftDistance) * (deltaTime * 0.005);

  // show gallery
  updateMaxMiniCanvasRows();
  strokeWeight(2);
  stroke(255);
  noFill();
  savedCanvas.forEach((v, i) => {
    if(i === savedCanvas.length - 1) stroke(orangeColor);

    if(maxMiniCanvasRows === 2) {
      let posCorner = miniCanvasPosition(i, savedCanvas.length);
      let posCenter = [posCorner[0] + 0.5 * miniCanvasSize, posCorner[1] + 0.5 * miniCanvasSize];
      image(v, posCorner[0], posCorner[1], miniCanvasSize, miniCanvasSize);
      circle(posCenter[0], posCenter[1], miniCanvasSize);
      if(mouseIsOnButton(posCenter, 0.5 * miniCanvasSize)) {
        stroke(255);
        drawCross(posCenter, miniCanvasSize * 0.9);
      }
    } else if(maxMiniCanvasRows === 1 && i >= savedCanvas.length-3) {
      let posCorner = miniCanvasPosition(i-max(savedCanvas.length-3, 0), min(savedCanvas.length, 3));
      let posCenter = [posCorner[0] + 0.5 * miniCanvasSize, posCorner[1] + 0.5 * miniCanvasSize];
      image(v, posCorner[0], posCorner[1], miniCanvasSize, miniCanvasSize);
      circle(posCenter[0], posCenter[1], miniCanvasSize);
      if(mouseIsOnButton(posCenter, 0.5 * miniCanvasSize)) {
        stroke(255);
        drawCross(posCenter, miniCanvasSize * 0.9);
      }
    }
  })

    // timerCkpt();
}

function captureCanvas() {
  // copy main canvas
  let tmpCanvas = createGraphics(miniCanvasSize, miniCanvasSize);
  tmpCanvas.copy(canvas, (width-2*radius)/2-currentShiftDistance, (height-2*radius)/2, 2*radius, 2*radius, 0, 0, miniCanvasSize, miniCanvasSize);
  if(savedCanvas.length === 6) {
    savedCanvas.shift();
  }
  // cover capture button & info panel
  tmpCanvas.fill(bgColor);
  tmpCanvas.noStroke();
  tmpCanvas.triangle(0, miniCanvasSize, 0, miniCanvasSize * Math.sqrt(0.5), miniCanvasSize * (1 - Math.sqrt(0.5)), miniCanvasSize);
  tmpCanvas.triangle(0, 0, 0, miniCanvasSize * (1 - Math.sqrt(0.5)), miniCanvasSize * (1 - Math.sqrt(0.5)), 0);
  tmpCanvas.triangle(miniCanvasSize, 0, miniCanvasSize, miniCanvasSize * (1 - Math.sqrt(0.5)), miniCanvasSize * Math.sqrt(0.5), 0);
  tmpCanvas.triangle(miniCanvasSize, miniCanvasSize, miniCanvasSize * Math.sqrt(0.5), miniCanvasSize, miniCanvasSize, miniCanvasSize * Math.sqrt(0.5));
  savedCanvas.push(tmpCanvas)
}

function miniCanvasPosition(index, total) {
  if(total <= 3) {
    return [-(miniCanvasSize + miniCanvasGap), index * (miniCanvasSize + miniCanvasGap)]
  } else {
    return [(Math.floor(index / 3) - 2) * (miniCanvasSize + miniCanvasGap), (index % 3) * (miniCanvasSize + miniCanvasGap)]
  }
}

function shiftDistance() {
  let tmp;
  if(savedCanvas.length === 0) tmp = 0;
  else if (savedCanvas.length <= 3) tmp = -(miniCanvasSize + miniCanvasGap) * 0.5;
  else tmp = -2 * (miniCanvasSize + miniCanvasGap) * 0.5;

  if(savedCanvas.length === 0) tmp = 0;
  else if (savedCanvas.length <= 3) tmp = 1;
  else tmp = 2;

  return -min(tmp, maxMiniCanvasRows) * (miniCanvasSize + miniCanvasGap) * 0.5;
}

function updateMaxMiniCanvasRows() {
  if(width - radius * 2 - (miniCanvasSize + miniCanvasGap) * 2 - distanceToEdge * 2 >= 0) maxMiniCanvasRows = 2;
  else if(width - radius * 2 - (miniCanvasSize + miniCanvasGap) - distanceToEdge * 2 >= 0) maxMiniCanvasRows = 1;
  else maxMiniCanvasRows = 0;
}

function getCaptureButtonCenter() {
  return [radius*(buttonSizeRatio+0.07), radius*(2-buttonSizeRatio-0.07)]
}

function mouseIsOnButton(c, r) {
  return dist(mouseX-(width/2-radius-currentShiftDistance), mouseY-(height/2-radius), c[0], c[1]) < r;
}

function getHandleCenter() {
  return [radius * (1 + 1.07 * cos(actualAngle)), radius * (1 + 1.07 * sin(actualAngle))];
}

function mouseIsNearHandle() {
  let handleCenter = getHandleCenter();
  return dist(mouseX-(width/2-radius-currentShiftDistance), mouseY-(height/2-radius), handleCenter[0], handleCenter[1]) < radius*0.2;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  radius = min((width - 2 * distanceToEdge) / 2, (height - 2 * distanceToEdge) / 2);
  blockLength = radius * 2 / res;

  miniCanvasSize = Math.round(2 * radius * miniCanvasRatio);
  miniCanvasGap = 2 * radius * (1-3*miniCanvasRatio)/2;

  positionArray = Array.from(Array(numberOfPins).keys()).map((v) => {
    return [radius * (1 + 0.99*cos(2*v/numberOfPins*Math.PI)), radius * (1 + 0.99*sin(2*v/numberOfPins*Math.PI))]
  });
}

function keyTyped() {
  if(key === 'f' || key === 'F') {
    showFrameRate = !showFrameRate;
  } else if(key === 'a' || key === 'A') {
    showAsciiArt = !showAsciiArt;
  } else if(key === 'c' || key === 'C') {
    captureCanvas();
  }
}

function mousePressed() {
  // console.log("pressed");
  draggingHandle = true;
  mouseStartPosition = [mouseX, mouseY];
}

function mouseReleased() {
  draggingHandle = false;
  handleAngle += handleAngleDragging;
  handleAngleDragging = 0;

  if(maxMiniCanvasRows > 0 && mouseIsOnButton(getCaptureButtonCenter(), radius * buttonSizeRatio)){
    captureCanvas();
    return
  }

  savedCanvas.forEach((v, i) => {
    if(maxMiniCanvasRows === 2) {
      let posCorner = miniCanvasPosition(i, savedCanvas.length);
      let posCenter = [posCorner[0] + 0.5 * miniCanvasSize, posCorner[1] + 0.5 * miniCanvasSize];
      if(mouseIsOnButton(posCenter, 0.5 * miniCanvasSize)) {
        savedCanvas.splice(i, 1);
      }
    } else if(maxMiniCanvasRows === 1 && i >= savedCanvas.length-3) {
      let posCorner = miniCanvasPosition(i-max(savedCanvas.length-3, 0), min(savedCanvas.length, 3));
      let posCenter = [posCorner[0] + 0.5 * miniCanvasSize, posCorner[1] + 0.5 * miniCanvasSize];
      if(mouseIsOnButton(posCenter, 0.5 * miniCanvasSize)) {
        savedCanvas.splice(i, 1);
      }
    }
  })
}

function mouseDragged() {
  handleAngleDragging = 2 * map(mouseY - mouseStartPosition[1], -height/2, height/2, -Math.PI/4, Math.PI/4);
}
