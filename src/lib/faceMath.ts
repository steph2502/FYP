/**
 * Numerical Linear Algebra library for Facial Recognition (PCA & LDA)
 */

// Downsample and convert canvas to raw grayscale 32x32 vector (values 0.0 to 1.0)
export function processCanvasToVector(canvas: HTMLCanvasElement): number[] {
  const size = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Array(size * size).fill(0);

  // Draw scaled image to an offscreen canvas of 32x32
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = size;
  tempCanvas.height = size;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return new Array(size * size).fill(0);

  // Draw input canvas cropped/fitted to 32x32
  tempCtx.drawImage(canvas, 0, 0, size, size);
  const imgData = tempCtx.getImageData(0, 0, size, size);
  const data = imgData.data;

  const vector: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Grayscale conversion using luminance formula
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    vector.push(gray / 255.0);
  }

  return vector;
}

// Check if a captured vector represents a valid face structure
export function isFacePresent(vector: number[]): { present: boolean; reason?: string } {
  if (!vector || vector.length === 0) {
    return { present: false, reason: "No image capture stream available." };
  }

  // 1. Calculate average brightness
  let sum = 0;
  for (let i = 0; i < vector.length; i++) {
    sum += vector[i];
  }
  const mean = sum / vector.length;

  // Relaxed light limits: allow a wider range of indoor lighting conditions
  if (mean < 0.06) {
    return { present: false, reason: "Viewport is too dark. Ensure adequate facial lighting." };
  }
  if (mean > 0.94) {
    return { present: false, reason: "Viewport is overexposed. Adjust light levels." };
  }

  // 2. Calculate Standard Deviation (Contrast check to filter flat, blank frames)
  let varianceSum = 0;
  for (let i = 0; i < vector.length; i++) {
    const diff = vector[i] - mean;
    varianceSum += diff * diff;
  }
  const stdDev = Math.sqrt(varianceSum / vector.length);

  // Covered webcams or blank walls have extremely low standard deviation (under 0.03)
  // Real faces with high resolution downsampling have stdDev typically around 0.04 to 0.25 (hair, eyes, shadow depth)
  if (stdDev < 0.035) {
    return { present: false, reason: "No face detected (flat contrast or camera covered)." };
  }

  // 3. Compute local spatial edge gradients (Texture Check)
  // A face has high-contrast edge structures (eyebrows, nose bridge, eye cavities, lips)
  const size = 32;
  let gradientSum = 0;
  let gradCount = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      if (x < size - 1) {
        gradientSum += Math.abs(vector[idx] - vector[idx + 1]);
        gradCount++;
      }
      if (y < size - 1) {
        gradientSum += Math.abs(vector[idx] - vector[idx + size]);
        gradCount++;
      }
    }
  }
  const avgGradient = gradientSum / gradCount;

  // Solid gradients are very low for covered cameras, flat walls, or dark empty frames
  // Let's use a relaxed limit of 0.007 to allow smooth cameras but reject empty scenes
  if (avgGradient < 0.007) {
    return { present: false, reason: "Facial structures missing. Center your face inside the crop-box." };
  }

  return { present: true };
}

// Generate pre-enrolled mock facial vectors for training data
// It generates actual 2D mathematical base patterns with small noise perturbations
export function generateMockStudentVectors(studentIndex: number, samples = 5): number[][] {
  const size = 32;
  const vectors: number[][] = [];

  for (let s = 0; s < samples; s++) {
    const vector = new Array(size * size).fill(0);
    // Base features
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        const nx = (x - size / 2) / (size / 2);
        const ny = (y - size / 2) / (size / 2);
        const dist = Math.sqrt(nx * nx + ny * ny);

        let intensity = 0.5;

        if (studentIndex === 0) {
          // Horizontal stripes + central eye-like spots (Arthur Cayley style)
          intensity = 0.4 + 0.3 * Math.sin(ny * 4) + 0.15 * Math.cos(nx * 8);
          // Add face boundary
          if (dist > 0.8) intensity *= 0.3;
        } else if (studentIndex === 1) {
          // Radial concentric circles + vertical nose line (Ada Lovelace style)
          intensity = 0.6 - 0.4 * dist + 0.2 * Math.sin(nx * 10);
          if (Math.abs(nx) < 0.15 && ny > -0.2 && ny < 0.5) intensity += 0.25; // nose
          if (dist > 0.85) intensity *= 0.2;
        } else {
          // Diagonal shadows + horizontal brow ridge (Alan Turing style)
          intensity = 0.5 + 0.2 * (nx + ny) + 0.15 * Math.sin(ny * 6);
          // Eyes
          if (ny > -0.3 && ny < -0.15 && Math.abs(Math.abs(nx) - 0.3) < 0.1) intensity -= 0.3;
          if (dist > 0.8) intensity *= 0.25;
        }

        // Add a bit of sample-specific perturbation (rotations, scales, noise) to act as training variation
        const noise = (Math.random() - 0.5) * 0.08;
        const pert = 0.05 * Math.sin(nx * (s + 1)) * Math.cos(ny * (s + 2));
        
        vector[idx] = Math.max(0, Math.min(1, intensity + noise + pert));
      }
    }
    vectors.push(vector);
  }

  return vectors;
}

// Convert a grayscale normalized 32x32 vector back to canvas pixels for visual diagnostics
export function drawVectorToCanvas(vector: number[], canvas: HTMLCanvasElement): void {
  const size = 32;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  // Find min/max values to normalize vector for high contrast rendering (important for ghostly eigenfaces!)
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < vector.length; i++) {
    if (vector[i] < min) min = vector[i];
    if (vector[i] > max) max = vector[i];
  }
  const range = max - min || 1;

  for (let i = 0; i < vector.length; i++) {
    // contrast-stretched output for display
    const val = ((vector[i] - min) / range) * 255;
    const idx = i * 4;
    data[idx] = val;     // R
    data[idx + 1] = val; // G
    data[idx + 2] = val; // B
    data[idx + 3] = 255; // A
  }

  ctx.putImageData(imgData, 0, 0);
}

// Jacobi Eigenvalue Solver for symmetric real matrices (A^T A)
// Solves details: S V = V D, where S is symmetric matrix of size M x M.
// Returns eigenvalues and eigenvectors.
export function jacobiEigenvalueSolver(S: number[][], maxIter = 1000): { eigenvalues: number[]; eigenvectors: number[][] } {
  const M = S.length;
  // Initialize eigenvectors as identity matrix V
  const V: number[][] = Array.from({ length: M }, (_, i) => {
    const row = new Array(M).fill(0);
    row[i] = 1;
    return row;
  });

  // Copy matrix S into A (scratchpad for rotations)
  const A: number[][] = S.map(row => [...row]);

  let count = 0;
  const eps = 1e-9;

  while (count < maxIter) {
    // Find the largest off-diagonal element
    let maxVal = 0;
    let p = 0;
    let q = 0;

    for (let i = 0; i < M; i++) {
      for (let j = i + 1; j < M; j++) {
        if (Math.abs(A[i][j]) > maxVal) {
          maxVal = Math.abs(A[i][j]);
          p = i;
          q = j;
        }
      }
    }

    // If largest off-diagonal is virtually zero, we have converged
    if (maxVal < eps) {
      break;
    }

    // Compute rotation angle (theta)
    const diff = A[q][q] - A[p][p];
    let t = 0;
    if (Math.abs(A[p][q]) < eps) {
      t = 0;
    } else {
      const phi = diff / (2 * A[p][q]);
      if (phi >= 0) {
        t = 1 / (phi + Math.sqrt(1 + phi * phi));
      } else {
        t = -1 / (-phi + Math.sqrt(1 + phi * phi));
      }
    }

    const c = 1 / Math.sqrt(1 + t * t);
    const s = t * c;
    const tau = s / (1 + c);

    // Update diagonal and off-diagonal elements in A
    const a_pp = A[p][p];
    const a_qq = A[q][q];
    const a_pq = A[p][q];

    A[p][p] = a_pp - t * a_pq;
    A[q][q] = a_qq + t * a_pq;
    A[p][q] = 0;
    A[q][p] = 0;

    // Rotate other values in rows p and q
    for (let i = 0; i < M; i++) {
      if (i !== p && i !== q) {
        const a_ip = A[i][p];
        const a_iq = A[i][q];
        A[i][p] = a_ip - s * (a_iq + a_ip * tau);
        A[p][i] = A[i][p];
        A[i][q] = a_iq + s * (a_ip - a_iq * tau);
        A[q][i] = A[i][q];
      }
    }

    // Update eigenvectors V
    for (let i = 0; i < M; i++) {
      const v_ip = V[i][p];
      const v_iq = V[i][q];
      V[i][p] = v_ip - s * (v_iq + v_ip * tau);
      V[i][q] = v_iq + s * (v_ip - v_iq * tau);
    }

    count++;
  }

  // Extract eigenvalues from diagonal of A
  const eigenvalues: number[] = [];
  for (let i = 0; i < M; i++) {
    eigenvalues.push(A[i][i]);
  }

  return { eigenvalues, eigenvectors: V };
}

// Complete training cycle of PCA (Eigenfaces) and LDA (Fisherfaces)
export interface TrainedFaceSpace {
  averageFace: number[];
  eigenfaces: number[][]; // top eigenfaces in pixel space (1024 floats)
  eigenvalues: number[];  // matching eigenvalues
  fisherfaces: number[][]; // Fisher projections in pixel space (1024 floats)
  explainVariancePct: number[]; // scree-plot metadata
  studentProjections: {
    studentId: string;
    studentUniqueId: string; // real db unique ID
    name: string;
    pcaWeights: number[];
    ldaWeights: number[];
    rawVector?: number[]; // stored raw pixel template
  }[];
}

export function trainModels(
  students: { id: string; studentId: string; name: string; faceVectors: number[][] }[]
): TrainedFaceSpace | null {
  // Collect all face vectors from all students
  const allSamples: { studentId: string; id: string; name: string; vector: number[] }[] = [];
  students.forEach(student => {
    student.faceVectors.forEach(v => {
      allSamples.push({ studentId: student.studentId, id: student.id, name: student.name, vector: v });
    });
  });

  const M = allSamples.length;
  if (M === 0) return null;
  const N = 1024; // 32x32 dimensions

  // 1. Compute average face
  const averageFace = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    let sum = 0;
    for (let j = 0; j < M; j++) {
      sum += allSamples[j].vector[i];
    }
    averageFace[i] = sum / M;
  }

  // 2. Subtract average face to get deviations Matrix A
  const A: number[][] = [];
  for (let j = 0; j < M; j++) {
    const deviation = new Array(N);
    for (let i = 0; i < N; i++) {
      deviation[i] = allSamples[j].vector[i] - averageFace[i];
    }
    A.push(deviation);
  }

  // 3. Compute A^T * A (size M x M) for SVD Sieve trick
  const ATA: number[][] = Array.from({ length: M }, () => new Array(M).fill(0));
  for (let r = 0; r < M; r++) {
    for (let c = r; c < M; c++) {
      let dot = 0;
      for (let i = 0; i < N; i++) {
        dot += A[r][i] * A[c][i];
      }
      ATA[r][c] = dot;
      ATA[c][r] = dot; // Symmetric
    }
  }

  // 4. Solve eigenvalues & eigenvectors of ATA
  const { eigenvalues, eigenvectors } = jacobiEigenvalueSolver(ATA);

  // Sort components descending by eigenvalue
  const indices = Array.from({ length: M }, (_, i) => i);
  indices.sort((a, b) => eigenvalues[b] - eigenvalues[a]);

  const sortedEigenvalues = indices.map(i => Math.max(0, eigenvalues[i]));
  const sumEigenvalues = sortedEigenvalues.reduce((sum, val) => sum + val, 0) || 1;
  const explainVariancePct = sortedEigenvalues.map(v => (v / sumEigenvalues) * 100);

  // 5. Construct Eigenfaces in 1024-dimensional space: Eigenface_k = A * v_k
  // and normalize to unit length.
  const eigenfaces: number[][] = [];
  const numEigenfaces = Math.min(10, M); // Keep at most top 10 eigenfaces

  for (let k = 0; k < numEigenfaces; k++) {
    const origIdx = indices[k];
    const v_k = eigenvectors.map(row => row[origIdx]); // Eigenvector k

    // Composite: u_k = A * v_k
    let u_k = new Array(N).fill(0);
    let normSq = 0;
    for (let i = 0; i < N; i++) {
      let val = 0;
      for (let j = 0; j < M; j++) {
        val += A[j][i] * v_k[j];
      }
      u_k[i] = val;
      normSq += val * val;
    }

    const norm = Math.sqrt(normSq) || 1e-9;
    for (let i = 0; i < N; i++) {
      u_k[i] /= norm;
    }
    eigenfaces.push(u_k);
  }

  // 6. Project all training images onto PCA eigenface space to get PCA weights
  // Projection weights represent the relative coordinates in Eigenface-space
  const studentProjections = allSamples.map(sample => {
    const deviation = sample.vector.map((val, idx) => val - averageFace[idx]);
    const pcaWeights = eigenfaces.map(e => {
      let val = 0;
      for (let i = 0; i < N; i++) {
        val += deviation[i] * e[i];
      }
      return val;
    });

    return {
      studentId: sample.studentId,
      studentUniqueId: sample.id,
      name: sample.name,
      pcaWeights,
      ldaWeights: [] as number[], // Compiled next
      rawVector: sample.vector,
    };
  });

  // 7. Computing LDA (Linear Discriminant Analysis) / Fisherfaces
  // Since high dimensions are singular, we project training samples to PCA weights (e.g. top 6 PCs)
  // then perform LDA on this lower-dimensional representation!
  // This calculates high-class-separability axes that map PCA coordinates into Fisher coordinates.
  const pcaDim = Math.min(6, numEigenfaces);
  const classes = Array.from(new Set(allSamples.map(s => s.studentId)));
  const C = classes.length;

  let fisherfacesInPixelSpace: number[][] = [];

  if (C > 1 && pcaDim > 1) {
    // a. Compute class means in PCA weight space
    const classMeansMap = new Map<string, number[]>();
    classes.forEach(cId => {
      const cProj = studentProjections.filter(s => s.studentId === cId);
      const mean = new Array(pcaDim).fill(0);
      cProj.forEach(p => {
        for (let j = 0; j < pcaDim; j++) {
          mean[j] += p.pcaWeights[j];
        }
      });
      for (let j = 0; j < pcaDim; j++) mean[j] /= cProj.length;
      classMeansMap.set(cId, mean);
    });

    // b. Compute grand mean in PCA weight space
    const grandMean = new Array(pcaDim).fill(0);
    studentProjections.forEach(p => {
      for (let j = 0; j < pcaDim; j++) {
        grandMean[j] += p.pcaWeights[j];
      }
    });
    for (let j = 0; j < pcaDim; j++) grandMean[j] /= M;

    // c. Compute Scatter Matrix Within Classes (Sw) and Between Classes (Sb) in PCA space
    const Sw = Array.from({ length: pcaDim }, () => new Array(pcaDim).fill(0));
    const Sb = Array.from({ length: pcaDim }, () => new Array(pcaDim).fill(0));

    studentProjections.forEach(p => {
      const mean = classMeansMap.get(p.studentId)!;
      for (let r = 0; r < pcaDim; r++) {
        for (let c = 0; c < pcaDim; c++) {
          const devR = p.pcaWeights[r] - mean[r];
          const devC = p.pcaWeights[c] - mean[c];
          Sw[r][c] += devR * devC;
        }
      }
    });

    classes.forEach(cId => {
      const cProj = studentProjections.filter(s => s.studentId === cId);
      const mean = classMeansMap.get(cId)!;
      const Nc = cProj.length;
      for (let r = 0; r < pcaDim; r++) {
        for (let c = 0; c < pcaDim; c++) {
          const devR = mean[r] - grandMean[r];
          const devC = mean[c] - grandMean[c];
          Sb[r][c] += Nc * devR * devC;
        }
      }
    });

    // d. Regularize Sw to be safely invertible: Sw = Sw + lambda * I (Shrinkage technique)
    const shrinkage = 0.5;
    for (let r = 0; r < pcaDim; r++) {
      Sw[r][r] += shrinkage;
    }

    // e. Solve Sw^-1 * Sb
    // Since Sw is small (pcaDim x pcaDim), we can easily invert it using a simple Gaussian elimination solver.
    const invSw = invertSymmetricMatrix(Sw);
    if (invSw) {
      // S = invSw * Sb
      const S = Array.from({ length: pcaDim }, () => new Array(pcaDim).fill(0));
      for (let r = 0; r < pcaDim; r++) {
        for (let c = 0; c < pcaDim; c++) {
          let sum = 0;
          for (let k = 0; k < pcaDim; k++) {
            sum += invSw[r][k] * Sb[k][c];
          }
          S[r][c] = sum;
        }
      }

      // S in general is not symmetric, but we can symmetrize or run Jacobi solver to find Fisher coefficients.
      // SVD of invSw * Sb can also be approximated. Let's run a robust diagonalization or extract axes from A_tilde:
      const { eigenvectors: ldaVectors } = jacobiEigenvalueSolver(symmetrize(S));

      // f. Convert LDA projection axes from PCA space back to pixel space!
      // Fisherfaces = eigenfaces * ldaVectors
      const numFisheraxes = Math.min(3, C - 1); // LDA has at most C - 1 dimensions
      for (let k = 0; k < numFisheraxes; k++) {
        const rowAxes = ldaVectors[k]; // coeff vector to scale the eigenfaces
        const fFace = new Array(N).fill(0);
        for (let i = 0; i < N; i++) {
          let val = 0;
          for (let j = 0; j < pcaDim; j++) {
            val += rowAxes[j] * eigenfaces[j][i];
          }
          fFace[i] = val;
        }
        // Unit-normalize
        let fNormSq = fFace.reduce((sum, val) => sum + val * val, 0);
        const fNorm = Math.sqrt(fNormSq) || 1e-9;
        fisherfacesInPixelSpace.push(fFace.map(val => val / fNorm));
      }
    }
  }

  // If LDA computation could not run (e.g. 1 class), we fake components or fallback to primary PCA axes
  if (fisherfacesInPixelSpace.length === 0) {
    fisherfacesInPixelSpace = eigenfaces.slice(0, 2);
  }

  // 8. Re-evaluate student projections with completed LDA coordinates
  studentProjections.forEach(p => {
    // Calculate LDA weight: project dot(deviation, Fisherface_k)
    const deviation = allSamples.find(s => s.studentId === p.studentId)!.vector.map((val, idx) => val - averageFace[idx]);
    p.ldaWeights = fisherfacesInPixelSpace.map(ff => {
      let sum = 0;
      for (let i = 0; i < N; i++) {
        sum += deviation[i] * ff[i];
      }
      return sum;
    });
  });

  return {
    averageFace,
    eigenfaces,
    eigenvalues: sortedEigenvalues,
    fisherfaces: fisherfacesInPixelSpace,
    explainVariancePct,
    studentProjections,
  };
}

// Projection function for live test images
export function recognizeFace(
  testVector: number[],
  model: TrainedFaceSpace,
  method: 'PCA' | 'LDA' = 'PCA'
): {
  closestStudentId: string;
  name: string;
  distance: number;
  confidence: number;
  projectedWeights: number[];
} {
  const N = 1024;
  const deviation = testVector.map((val, idx) => val - model.averageFace[idx]);

  // Project
  const projWeights = (method === 'PCA' ? model.eigenfaces : model.fisherfaces).map(f => {
    let sum = 0;
    for (let i = 0; i < N; i++) {
      sum += deviation[i] * f[i];
    }
    return sum;
  });

  // Find nearest neighbor in the projected training space
  let minDistance = Infinity;
  let closestSample: typeof model.studentProjections[0] | null = null;

  model.studentProjections.forEach(sample => {
    const sampleWeights = method === 'PCA' ? sample.pcaWeights : sample.ldaWeights;
    
    // Compute Euclidean distance in weight space
    let distSum = 0;
    const len = Math.min(projWeights.length, sampleWeights.length);
    for (let j = 0; j < len; j++) {
      const diff = projWeights[j] - sampleWeights[j];
      distSum += diff * diff;
    }
    const dist = Math.sqrt(distSum);

    if (dist < minDistance) {
      minDistance = dist;
      closestSample = sample;
    }
  });

  // Calculate confidence score based on relative distance thresholds
  // Grayscale pixel coordinates ranges mean distance is typically between 0.1 to 6.0
  // Threshold value of 2.5 is typical for PCA grayscales matching
  const threshold = method === 'PCA' ? 1.8 : 1.2;
  const maxUncertainty = threshold * 1.5;

  let confidence = 0;
  if (minDistance < threshold) {
    confidence = Math.round(98 - (minDistance / threshold) * 20); // 78% to 98%
  } else if (minDistance < maxUncertainty) {
    confidence = Math.round(78 - ((minDistance - threshold) / (maxUncertainty - threshold)) * 38); // 40% to 78%
  } else {
    confidence = Math.max(12, Math.round(40 - (minDistance / maxUncertainty) * 20));
  }

  // Absolute raw pixel distance check as a fail-safe template validation
  if (closestSample && closestSample.rawVector) {
    let rawDistSq = 0;
    for (let i = 0; i < N; i++) {
      const diff = testVector[i] - closestSample.rawVector[i];
      rawDistSq += diff * diff;
    }
    const rawDist = Math.sqrt(rawDistSq);

    // If raw pixel Euclidean distance is larger than biometric bounds, penalize the confidence score heavily
    // Real faces (even with expression shifts or small illumination differences) stay under 5.8. 
    // Wall, hand, objects, noise, uninitialized frames yield raw distances of 6.5 to 16.0.
    const baseRawThreshold = 5.8;
    if (rawDist > baseRawThreshold) {
      // Linearly decay confidence down to a secure baseline of 5-15%
      const penaltyRange = 1.8; // completely zero out when distance goes beyond baseRawThreshold + penaltyRange (7.6)
      const ratio = Math.min(1, (rawDist - baseRawThreshold) / penaltyRange);
      confidence = Math.max(5, Math.round(confidence * (1 - ratio)));
    }
  } else {
    // Fallback if no raw vector template exists (penalize slightly as precaution)
    confidence = Math.max(5, Math.round(confidence * 0.5));
  }

  // Prevent NaN or overflow
  if (isNaN(confidence)) confidence = 50;
  confidence = Math.min(99, Math.max(1, confidence));

  return {
    closestStudentId: closestSample ? (closestSample as any).studentId : 'UNKNOWN',
    name: closestSample ? (closestSample as any).name : 'Unknown Identity',
    distance: parseFloat(minDistance.toFixed(4)),
    confidence,
    projectedWeights: projWeights,
  };
}

// Simple symmetric matrix invert utility
function invertSymmetricMatrix(A: number[][]): number[][] | null {
  const n = A.length;
  // Gauss-Jordan elimination on Augmented [A | I]
  const M = A.map((row, i) => {
    const aug = [...row];
    for (let j = 0; j < n; j++) {
      aug.push(i === j ? 1 : 0);
    }
    return aug;
  });

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(M[r][i]) > Math.abs(M[maxRow][i])) {
        maxRow = r;
      }
    }

    // Swap matrix rows
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    if (Math.abs(M[i][i]) < 1e-12) {
      return null; // Singular or unstable
    }

    // Normalize pivot row
    const pivot = M[i][i];
    for (let col = i; col < 2 * n; col++) {
      M[i][col] /= pivot;
    }

    // Eliminate other rows
    for (let r = 0; r < n; r++) {
      if (r !== i) {
        const factor = M[r][i];
        for (let col = i; col < 2 * n; col++) {
          M[r][col] -= factor * M[i][col];
        }
      }
    }
  }

  // Extract right half
  return M.map(row => row.slice(n));
}

// Symmetrize a matrix so that jacobi can run stably on non-symmetric forms
function symmetrize(A: number[][]): number[][] {
  const n = A.length;
  const sym = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      sym[r][c] = (A[r][c] + A[c][r]) / 2;
    }
  }
  return sym;
}
