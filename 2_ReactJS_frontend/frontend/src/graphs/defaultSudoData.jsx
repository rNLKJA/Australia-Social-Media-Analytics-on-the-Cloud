export const defaultSudoData = {
  title: "Melbourne CBD",
  map: "empty",
  data: [
    {
      type: "scattermapbox",
      mode: "markers",
      marker: { size: 0 },
      geojson: {
        type: "FeatureCollection",
        features: [],
      },
    },
  ],
  layout: {
    mapbox: {
      center: { lat: -37.8136, lon: 144.9631 },
      zoom: 14,
    },
  },
};
