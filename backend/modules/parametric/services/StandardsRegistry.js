class StandardsRegistry {
  constructor() {
    this._standards = {};
    this._init();
  }

  _init() {
    this.register('eurocode', {
      label: 'Eurocode 2',
      code: 'EC2',
      beam: {
        spanDepth: { simply_supported: 12, continuous: 14, cantilever: 6 },
        minDepthMm: 200,
        widthRatio: { min: 2, max: 3 },
        minWidthMm: 150,
        modularSizes: [150, 200, 225, 250, 300, 375, 450],
        coverMm: 30,
        rebarKgM3: 120
      },
      column: {
        minSizeMm: 250,
        heightRatio: { min: 10, max: 15 },
        coverMm: 30,
        rebarKgM3: 150,
        modularSizes: [200, 225, 250, 300, 350, 400, 450, 500, 600]
      },
      rectangularColumn: {
        minSizeMm: 250,
        minDepthMm: 250,
        heightRatio: { min: 10, max: 15 },
        coverMm: 30,
        rebarKgM3: 150
      },
      circularColumn: {
        minDiameterMm: 300,
        standardDiameters: [300, 450, 600, 900, 1200],
        coverMm: 40,
        rebarKgM3: 160,
        longBarSpacingMm: 200,
        spiralPitchMm: 100,
        minLongBars: 6
      },
      slab: {
        spanDepth: { one_way: 30, two_way: 35, flat: 28, cantilever: 10 },
        minThicknessMm: 120,
        coverMm: 25,
        rebarKgM3: 100
      },
      staircase: {
        waistSpanDepth: 20,
        minWaistMm: 100,
        treadMm: 270,
        riserMm: 150,
        coverMm: 25,
        rebarKgM3: 110
      },
      footing: {
        minThicknessMm: 200,
        minProjectionMm: 300,
        coverMm: 50,
        rebarKgM3: 80
      },
      wall: {
        minThicknessMm: 150,
        coverMm: 30,
        rebarKgM3: 100
      },
      cylindricalWall: {
        wallThicknessRatio: 40,
        minThicknessMm: 150,
        coverMm: 40,
        rebarKgM3: 120,
        hoopSpacingMm: 200,
        vertBarSpacingMm: 200
      },
      curvedBeam: {
        spanDepth: 12,
        minDepthMm: 200,
        widthRatio: { min: 2, max: 3 },
        minWidthMm: 150,
        coverMm: 30,
        rebarKgM3: 130
      },
      domeShell: {
        thicknessRatio: 60,
        minThicknessMm: 75,
        rebarKgM2: 15,
        coverMm: 25
      }
    });

    this.register('aci', {
      label: 'ACI 318',
      code: 'ACI',
      beam: {
        spanDepth: { simply_supported: 16, continuous: 21, cantilever: 8 },
        minDepthMm: 200,
        widthRatio: { min: 1.5, max: 2 },
        minWidthMm: 150,
        modularSizes: [150, 200, 250, 300, 375, 450],
        coverMm: 40,
        rebarKgM3: 130
      },
      column: {
        minSizeMm: 250,
        heightRatio: { min: 8, max: 12 },
        coverMm: 40,
        rebarKgM3: 160,
        modularSizes: [250, 300, 350, 400, 450, 500, 600]
      },
      rectangularColumn: { minSizeMm: 250, minDepthMm: 250, heightRatio: { min: 8, max: 12 }, coverMm: 40, rebarKgM3: 160 },
      circularColumn: {
        minDiameterMm: 300, standardDiameters: [300, 450, 600, 900, 1200], coverMm: 50, rebarKgM3: 170,
        longBarSpacingMm: 200, spiralPitchMm: 100, minLongBars: 6
      },
      slab: { spanDepth: { one_way: 20, two_way: 24, flat: 20, cantilever: 8 }, minThicknessMm: 125, coverMm: 20, rebarKgM3: 110 },
      staircase: { waistSpanDepth: 20, minWaistMm: 100, treadMm: 280, riserMm: 175, coverMm: 20, rebarKgM3: 120 },
      footing: { minThicknessMm: 300, minProjectionMm: 300, coverMm: 75, rebarKgM3: 90 },
      wall: { minThicknessMm: 150, coverMm: 20, rebarKgM3: 110 },
      cylindricalWall: { wallThicknessRatio: 36, minThicknessMm: 150, coverMm: 50, rebarKgM3: 130, hoopSpacingMm: 200, vertBarSpacingMm: 200 },
      curvedBeam: { spanDepth: 16, minDepthMm: 200, widthRatio: { min: 1.5, max: 2 }, minWidthMm: 150, coverMm: 40, rebarKgM3: 140 },
      domeShell: { thicknessRatio: 60, minThicknessMm: 100, rebarKgM2: 15, coverMm: 20 }
    });

    this.register('is456', {
      label: 'IS 456',
      code: 'IS',
      beam: {
        spanDepth: { simply_supported: 12, continuous: 15, cantilever: 6 },
        minDepthMm: 200,
        widthRatio: { min: 2, max: 2.5 },
        minWidthMm: 150,
        modularSizes: [150, 200, 225, 250, 300, 375, 450],
        coverMm: 30,
        rebarKgM3: 120
      },
      column: {
        minSizeMm: 225,
        heightRatio: { min: 10, max: 15 },
        coverMm: 40,
        rebarKgM3: 140,
        modularSizes: [200, 225, 250, 300, 350, 400, 450, 500, 600]
      },
      rectangularColumn: { minSizeMm: 225, minDepthMm: 225, heightRatio: { min: 10, max: 15 }, coverMm: 40, rebarKgM3: 140 },
      circularColumn: {
        minDiameterMm: 300, standardDiameters: [300, 450, 600, 900, 1200], coverMm: 40, rebarKgM3: 150,
        longBarSpacingMm: 200, spiralPitchMm: 100, minLongBars: 6
      },
      slab: { spanDepth: { one_way: 30, two_way: 35, flat: 28, cantilever: 10 }, minThicknessMm: 100, coverMm: 15, rebarKgM3: 90 },
      staircase: { waistSpanDepth: 20, minWaistMm: 100, treadMm: 250, riserMm: 150, coverMm: 15, rebarKgM3: 100 },
      footing: { minThicknessMm: 150, minProjectionMm: 250, coverMm: 50, rebarKgM3: 75 },
      wall: { minThicknessMm: 100, coverMm: 15, rebarKgM3: 90 },
      cylindricalWall: { wallThicknessRatio: 40, minThicknessMm: 150, coverMm: 40, rebarKgM3: 110, hoopSpacingMm: 200, vertBarSpacingMm: 200 },
      curvedBeam: { spanDepth: 12, minDepthMm: 200, widthRatio: { min: 2, max: 2.5 }, minWidthMm: 150, coverMm: 30, rebarKgM3: 125 },
      domeShell: { thicknessRatio: 60, minThicknessMm: 75, rebarKgM2: 12, coverMm: 15 }
    });

    this.register('bs8110', {
      label: 'BS 8110',
      code: 'BS',
      beam: {
        spanDepth: { simply_supported: 12, continuous: 15, cantilever: 6 },
        minDepthMm: 200,
        widthRatio: { min: 2, max: 3 },
        minWidthMm: 150,
        modularSizes: [150, 200, 225, 250, 300, 375, 450],
        coverMm: 30,
        rebarKgM3: 115
      },
      column: {
        minSizeMm: 225, heightRatio: { min: 10, max: 15 }, coverMm: 30, rebarKgM3: 140,
        modularSizes: [200, 225, 250, 300, 350, 400, 450, 500, 600]
      },
      rectangularColumn: { minSizeMm: 225, minDepthMm: 225, heightRatio: { min: 10, max: 15 }, coverMm: 30, rebarKgM3: 140 },
      circularColumn: {
        minDiameterMm: 300, standardDiameters: [300, 450, 600, 900, 1200], coverMm: 40, rebarKgM3: 150,
        longBarSpacingMm: 200, spiralPitchMm: 100, minLongBars: 6
      },
      slab: { spanDepth: { one_way: 30, two_way: 35, flat: 28, cantilever: 10 }, minThicknessMm: 100, coverMm: 20, rebarKgM3: 95 },
      staircase: { waistSpanDepth: 20, minWaistMm: 100, treadMm: 250, riserMm: 150, coverMm: 20, rebarKgM3: 105 },
      footing: { minThicknessMm: 200, minProjectionMm: 300, coverMm: 50, rebarKgM3: 80 },
      wall: { minThicknessMm: 150, coverMm: 20, rebarKgM3: 100 },
      cylindricalWall: { wallThicknessRatio: 40, minThicknessMm: 150, coverMm: 40, rebarKgM3: 115, hoopSpacingMm: 200, vertBarSpacingMm: 200 },
      curvedBeam: { spanDepth: 12, minDepthMm: 200, widthRatio: { min: 2, max: 3 }, minWidthMm: 150, coverMm: 30, rebarKgM3: 125 },
      domeShell: { thicknessRatio: 60, minThicknessMm: 75, rebarKgM2: 14, coverMm: 20 }
    });

    this.register('international', {
      label: 'International',
      code: 'INT',
      beam: {
        spanDepth: { simply_supported: 12, continuous: 14, cantilever: 6 },
        minDepthMm: 200,
        widthRatio: { min: 2, max: 3 },
        minWidthMm: 150,
        modularSizes: [150, 200, 225, 250, 300],
        coverMm: 30,
        rebarKgM3: 120
      },
      column: {
        minSizeMm: 230, heightRatio: { min: 10, max: 15 }, coverMm: 30, rebarKgM3: 150,
        modularSizes: [200, 225, 230, 250, 300, 350, 400, 450, 500, 600]
      },
      rectangularColumn: { minSizeMm: 230, minDepthMm: 230, heightRatio: { min: 10, max: 15 }, coverMm: 30, rebarKgM3: 150 },
      circularColumn: {
        minDiameterMm: 300, standardDiameters: [300, 450, 600, 900, 1200], coverMm: 40, rebarKgM3: 160,
        longBarSpacingMm: 200, spiralPitchMm: 100, minLongBars: 6
      },
      slab: { spanDepth: { one_way: 30, two_way: 35, flat: 28, cantilever: 10 }, minThicknessMm: 120, coverMm: 25, rebarKgM3: 100 },
      staircase: { waistSpanDepth: 20, minWaistMm: 100, treadMm: 270, riserMm: 150, coverMm: 25, rebarKgM3: 110 },
      footing: { minThicknessMm: 200, minProjectionMm: 300, coverMm: 50, rebarKgM3: 80 },
      wall: { minThicknessMm: 150, coverMm: 25, rebarKgM3: 100 },
      cylindricalWall: { wallThicknessRatio: 40, minThicknessMm: 150, coverMm: 40, rebarKgM3: 120, hoopSpacingMm: 200, vertBarSpacingMm: 200 },
      curvedBeam: { spanDepth: 12, minDepthMm: 200, widthRatio: { min: 2, max: 3 }, minWidthMm: 150, coverMm: 30, rebarKgM3: 130 },
      domeShell: { thicknessRatio: 60, minThicknessMm: 75, rebarKgM2: 15, coverMm: 25 }
    });
  }

  register(code, config) {
    this._standards[code] = config;
  }

  get(code) {
    return this._standards[code] || this._standards.international;
  }

  getElement(code, elementType) {
    const std = this.get(code);
    return std[elementType] || null;
  }

  listCodes() {
    return Object.keys(this._standards);
  }

  modularRound(value, sizes) {
    if (!sizes || sizes.length === 0) return Math.round(value / 25) * 25;
    let closest = sizes[0];
    for (const s of sizes) {
      if (Math.abs(s - value) < Math.abs(closest - value)) closest = s;
    }
    return closest;
  }
}

module.exports = new StandardsRegistry();
