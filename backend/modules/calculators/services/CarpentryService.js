class CarpentryService {
  static calculate({
    building_length_mm, building_width_mm, pitch_degrees = 25,
    eaves_projection_mm = 900, roof_type = 'hipped', sections = [],
    wall_plate_size = '75x100', tie_beam_size = '75x150',
    king_post_size = '100x100', rafter_size = '50x150',
    purlin_size = '50x75', fascia_size = '25x300',
    timber_grade = 'structural_hardwood', wastage_percent = 10
  }) {
    const L = building_length_mm / 1000;
    const W = building_width_mm / 1000;
    const pitchRad = (pitch_degrees * Math.PI) / 180;
    const halfSpan = W / 2;
    const ridgeHeight = +(halfSpan * Math.tan(pitchRad)).toFixed(3);

    // Wall Plate
    const wallPlatePerimeter = 2 * (L + W);
    const wallPlateWithWastage = +(wallPlatePerimeter * (1 + wastage_percent / 100)).toFixed(3);
    const wallPlatePieces = Math.ceil(wallPlateWithWastage / 6);

    // Tie Beams
    const tieBeanSpacing = 1.2;
    const noTieBeams = Math.ceil(L / tieBeanSpacing) + 1;
    const tieBalmLength = W + (2 * eaves_projection_mm / 1000);
    const tieBmeTotal = +(noTieBeams * tieBalmLength * (1 + wastage_percent / 100)).toFixed(3);

    // King Posts
    const noKingPosts = noTieBeams;
    const kpHeight = ridgeHeight + 0.30;
    const kpTotal = +(noKingPosts * kpHeight * (1 + wastage_percent / 100)).toFixed(3);

    // Rafters
    const rafterSlant = Math.sqrt(Math.pow(ridgeHeight, 2) + Math.pow(halfSpan, 2));
    const rafterWithEaves = rafterSlant + (eaves_projection_mm / 1000);
    const rafterLength = +rafterWithEaves.toFixed(3);

    const noRafterSpaces = Math.ceil(L / 0.6) + 1;
    const noRafters = noRafterSpaces * 2;
    const rafterTotal = +(noRafters * rafterLength * (1 + wastage_percent / 100)).toFixed(3);

    // Purlins
    const purlinSpacing = 0.9;
    const noPurlinRows = Math.ceil(rafterSlant / purlinSpacing) + 1;
    const purlinLengthPerRow = L + (2 * eaves_projection_mm / 1000);
    const purlinTotalRaw = noPurlinRows * purlinLengthPerRow * 2;
    const purlinTotal = +(purlinTotalRaw * (1 + wastage_percent / 100)).toFixed(3);

    // Fascia Board
    let fasciaPerimeter;
    if (roof_type === 'hipped') {
      fasciaPerimeter = 2 * ((L + 2 * eaves_projection_mm / 1000) + (W + 2 * eaves_projection_mm / 1000));
    } else {
      fasciaPerimeter = 2 * (L + 2 * eaves_projection_mm / 1000);
    }
    const fasciaTotal = +(fasciaPerimeter * (1 + wastage_percent / 100)).toFixed(3);

    // Section-by-section results
    const sectionResults = sections.map(sec => {
      const sh = sec.halfSpan_mm / 1000;
      const sl = sec.length_mm / 1000;
      const slantLength = +Math.sqrt(Math.pow(ridgeHeight, 2) + Math.pow(sh, 2)).toFixed(3);
      const withEaves = +(slantLength + eaves_projection_mm / 1000).toFixed(3);
      const avgLength = +((withEaves + 0) / 2).toFixed(3);
      return {
        section: sec.name,
        half_span_m: sh,
        rafter_slant_m: slantLength,
        rafter_with_eaves_m: withEaves,
        average_rafter_m: avgLength,
        no_rafters: Math.ceil(sl / 0.6) + 1
      };
    });

    return {
      inputs: { building_length_mm, building_width_mm, pitch_degrees, eaves_projection_mm, roof_type },
      derived: {
        ridge_height_m: ridgeHeight,
        rafter_slant_m: +rafterSlant.toFixed(3),
        rafter_with_eaves_m: rafterLength,
        no_tie_beam_positions: noTieBeams,
        no_rafter_pairs: noRafterSpaces,
        no_purlin_rows_each_side: noPurlinRows
      },
      summary: {
        wall_plate: {
          size: wall_plate_size + 'mm',
          total_length_m: wallPlateWithWastage,
          no_6m_pieces: wallPlatePieces,
          note: 'Hardwood treated, in continuous lengths'
        },
        tie_beams: {
          size: tie_beam_size + 'mm',
          quantity: noTieBeams,
          length_each_m: +tieBalmLength.toFixed(3),
          total_length_m: tieBmeTotal
        },
        king_posts: {
          size: king_post_size + 'mm',
          quantity: noKingPosts,
          height_each_m: +kpHeight.toFixed(3),
          total_length_m: kpTotal
        },
        rafters: {
          size: rafter_size + 'mm',
          quantity: noRafters,
          length_each_m: rafterLength,
          total_length_m: rafterTotal
        },
        purlins: {
          size: purlin_size + 'mm',
          no_rows_per_side: noPurlinRows,
          total_length_m: purlinTotal,
          spacing_m: purlinSpacing
        },
        fascia_board: {
          size: fascia_size + 'mm',
          total_length_m: fasciaTotal
        }
      },
      section_details: sectionResults.length > 0 ? sectionResults : null,
      wastage_percent
    };
  }
}

module.exports = CarpentryService;
