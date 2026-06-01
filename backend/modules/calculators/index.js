const isEnabled = () => process.env.CALCULATORS_MODULE_ENABLED !== 'false';

let services = {};
try {
  if (isEnabled()) {
    services = {
      Concrete: require('./services/ConcreteService'),
      Masonry: require('./services/MasonryService'),
      Plastering: require('./services/PlasteringService'),
      Paint: require('./services/PaintService'),
      Roofing: require('./services/RoofingService'),
      Steel: require('./services/SteelService'),
      Earthwork: require('./services/EarthworkService'),
      Tiling: require('./services/TilingService'),
      Carpentry: require('./services/CarpentryService'),
      Formwork: require('./services/FormworkService'),
      RoofAccessories: require('./services/RoofAccessoriesService'),
      DoorWindow: require('./services/DoorWindowService'),
      BrcDpm: require('./services/BrcDpmService')
    };
  }
} catch {
  // Module not available — services remain empty
}

module.exports = { services, isEnabled };
