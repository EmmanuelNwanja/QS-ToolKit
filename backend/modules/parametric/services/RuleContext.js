class RuleContext {
  constructor({ element_type, primary_dim_mm, standard = 'eurocode', overrides = {}, extra = {} }) {
    this.elementType = element_type;
    this.primaryDimMm = primary_dim_mm;
    this.standard = standard;
    this.overrides = overrides || {};
    this.extra = extra || {};

    this.supportType = extra.support_type || 'simply_supported';
    this.slabType = extra.slab_type || 'one_way';
    this.beamType = extra.beam_type || 'lateral';
    this.columnShape = extra.column_shape || 'square';
    this.loadAssumption = extra.load_assumption || 'medium';
    this.quantity = extra.quantity || 1;
  }

  getSpanM() { return this.primaryDimMm / 1000; }

  getPrimaryDimLabel() {
    const map = {
      beam: 'Span (mm)',
      column: 'Height (mm)',
      slab: 'Span (mm)',
      staircase: 'Waist span (mm)',
      footing: 'Column size (mm)',
      wall: 'Length (mm)',
      circular_column: 'Height (mm)',
      cylindrical_wall: 'Internal diameter (mm)',
      curved_beam: 'Chord length (mm)',
      dome_shell: 'Base diameter (mm)'
    };
    return map[this.elementType] || 'Primary dimension (mm)';
  }

  withOverride(field, autoValue) {
    if (this.overrides[field] !== undefined && this.overrides[field] !== null) {
      return {
        value: this.overrides[field],
        overridden: true,
        autoValue
      };
    }
    return { value: autoValue, overridden: false, autoValue };
  }
}

module.exports = { RuleContext };
