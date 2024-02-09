// my video size: 640 x 480

let numberOfPins = 134; // not multiple of 4
let radius = 300;
let res = 57; // odd number
let blockLength = radius * 2 / res;
let scaleVar = 1;
let distanceBetweenCenters = 2.3;

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

function getColorFromPixel(img, x, y) {
  let w = img.width;
  let i = (y*w+x)*4;
  return [img.pixels[i], img.pixels[i+1], img.pixels[i+2], img.pixels[i+3]];
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
  var slope = (first[1] - second[1]) / (first[0] - second[0]);
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
  if(first == second) return [];
  if(first > second) return getLineBlocks(second, first);
  return blocksInEachLine[first][second - first - 1];
}

function getVideoSample(x, y) {
  let c = getColorFromPixel(video, (horizontalRes-x-gap)*videoPixelPerBlock, y*videoPixelPerBlock);
  return filt(brightness(c) * 2.55);
}

// function getVideoSample(x, y) {
//   let x2 = horizontalRes-x-gap;
//   let c0 = getColorFromPixel(video, x2*videoPixelPerBlock,   y*videoPixelPerBlock);
//   let c1 = getColorFromPixel(video, x2*videoPixelPerBlock+1, y*videoPixelPerBlock);
//   let c2 = getColorFromPixel(video, x2*videoPixelPerBlock,   y*videoPixelPerBlock+1);
//   let c3 = getColorFromPixel(video, x2*videoPixelPerBlock+1, y*videoPixelPerBlock+1);
//   return filt((brightness(c0) + brightness(c1) + brightness(c2) + brightness(c3)) * 2.55 / 4);
// }

function diffFormula(canvas, truth) {
  // if(canvas > truth) {
  //   return 2 * (canvas - truth);
  // }
  // return truth - canvas;
  return Math.abs(truth - canvas);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  positionArray = Array.from(Array(numberOfPins).keys()).map((v) => {
    return [radius * (1 + 0.99*cos(2*v/numberOfPins*Math.PI)), radius * (1 + 0.99*sin(2*v/numberOfPins*Math.PI))]
  });

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
  // console.log(currentCanvas.length);
  // console.log(currentCanvas[res-1].length);

  // initialize lengthOfEachLine
  for(let i = 0; i < numberOfPins; i++){
    lengthOfEachLine.push(dist(positionArray[0][0], positionArray[0][1], positionArray[i][0], positionArray[i][1]) / radius / 2)
  }

  video.hide();
}

function draw() {
  background(20); 
  video.loadPixels();

  translate(width/2-radius*scaleVar, height/2-radius*scaleVar);
  scale(scaleVar);
  translate(-radius*distanceBetweenCenters/2, 0);

  videoPixelPerBlock = Math.floor(video.height / res);
  horizontalRes = Math.floor(res * video.width / video.height);
  gap = Math.floor((res * (video.width / video.height - 1)) / 2);

  // draw blocks
  // fill(0); 
  // stroke(0, 10);

  // for(let i = 0; i < res; i++) {
  //   for(let j = 0; j < res; j++) {
  //     rect(j * blockLength, i * blockLength, blockLength, blockLength);
  //   }
  // }

  // rect(0, 0, 2 * radius, 2 * radius);

  for(let k = 0; k < 50; k++) {
    // find best line
    var bestScore = -100000000;
    var bestLine = [];
    var bestValuePerBlock;
    for(let i1 = currentPin + 15; i1 <= currentPin + numberOfPins - 15; i1 += (Math.floor(Math.random() * 4) + 1)) {
      
      let i = i1 % numberOfPins;

      if(currentLines.length > 0 && i == currentLines[currentLines.length - 1][0]) continue;

      let blocks = getLineBlocks(currentPin, i);
      let lineTotalValue = coef * res * lengthOfEachLine[Math.abs(currentPin - i)];
      let valuePerBlock = lineTotalValue / blocks.length;
      let score = 0;

      blocks.forEach(e => {
        let canvas = currentCanvas[e[0]][e[1]];
        let truth = getVideoSample(e[0], e[1]);
        score += diffFormula(canvas, truth) - diffFormula(canvas + valuePerBlock, truth);
        // score += Math.abs(canvas - truth) - Math.abs(canvas + valuePerBlock - truth); // old difference - new difference 
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
      totalLines = min(5000, totalLines);
    } else {
      totalLines -= 50;
      totalLines = max(0, totalLines);
      break;
    }
  }

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

  // draw all lines in the queue
  stroke(255, 15);
  strokeWeight(0.8);
  currentLines.forEach(e => {
    line(positionArray[e[0]][0], positionArray[e[0]][1], positionArray[e[1]][0], positionArray[e[1]][1]);
  });
  
  // draw pins
  fill(255);
  stroke(0);
  for(let i = 0; i < numberOfPins; i++) {
    ellipse(positionArray[i][0], positionArray[i][1], 3, 3);
  }

  // show frame rate
  if(frameCount % 30 == 0) {
    fr = frameRate();
  }
  fill(240);
  text("Frame rate: " + str(Math.round(fr)), 5, 20);

  // draw indicator
  // fill(200, 0, 0)
  // stroke(0);
  // ellipse(20+10*cos(frameCount/10), 20+10*sin(frameCount/10), 8, 8);

  // show video sample
  translate(radius * distanceBetweenCenters, 0);
  noStroke();
  for(let i = 0; i < res; i++) {
    for(let j = 0; j < res; j++) {
      if(Math.pow(i-(res-1)/2, 2) + Math.pow(j-(res-1)/2, 2) <= Math.pow((res-1)/2, 2) + 1) {
        fill(getVideoSample(i, j));
        rect(i*blockLength, j*blockLength, blockLength * 1.05, blockLength * 1.05);
      }
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  radius = min(300, windowWidth / (distanceBetweenCenters + 2), height / 2);
  blockLength = radius * 2 / res;

  positionArray = Array.from(Array(numberOfPins).keys()).map((v) => {
    return [radius * (1 + 0.99*cos(2*v/numberOfPins*Math.PI)), radius * (1 + 0.99*sin(2*v/numberOfPins*Math.PI))]
  });
}
