const axios = require('axios');
const {POSTCODE_API, POSTCODE_AUTH_KEY, PRESENTATION_API, PRICES_API, LOCATION_API, FAQ_API} = require('./api.constants');

function lookupPostcode(postcode) {
    return new Promise((resolve, reject) => {
        axios.get(`${POSTCODE_API}${postcode}`, {headers: {'AUTH-KEY': POSTCODE_AUTH_KEY}})
          .then((response) => {
              const {localities} = response.data;
              if (localities === '') {
                  reject('Postcode not found');
              } else {
                  let {locality} = localities;

                  if (Array.isArray(locality)) {
                      locality = locality[0];
                  }

                  resolve({
                      location: locality.location,
                      postcode: locality.postcode,
                      state: locality.state
                  });
              }
          });
    });
}

function getPackagingTypes() {
    return [
        {
            label: '500g satchel',
            id: 'PKSS'
        },
        {
            label: '3kg satchel',
            id: 'PKSM'
        },
        {
            label: '5kg satchel',
            id: 'PKSL'
        }
    ];
}

function getPresentationMetadata() {
    const packagingTypeIds = getPackagingTypes().map((packagingType) => packagingType.id);
    return axios.get(PRESENTATION_API)
      .then((response) => {
          return response.data.services.map((service) => {
              return {
                  serviceId: service.id,
                  products: service.products.filter((product) => packagingTypeIds.includes(product.packaging_type))
              }
          })
      });
}

function getDeliveryOptions(fromPostcode, toPostcode, selectedPackagingTypeId) {
    return getPresentationMetadata()
      .then((products) => {
          return axios.post(PRICES_API, {
              from: { postcode: fromPostcode },
              to: { postcode: toPostcode },
              items: products.map((product) => ({
                  item_reference: product.serviceId,
                  product_ids: product.products.filter((product) => product.packaging_type === selectedPackagingTypeId).map((product) => product.id)
              }))
          });
      });
}

function getNearPostOffices(lat, long) {
    return axios.get(`${LOCATION_API}${encodeURIComponent(`${lat},${long}`)}`);
}

function getFAQs() {
    return axios.post(`${FAQ_API}`, {search:"MpbDas100",showPopular:true}, {headers: {'Authorization': 'Basic c3Nzd19mYXE6V2VsY29tZUAxMjM='}});

}

module.exports = {
    lookupPostcode,
    getPackagingTypes,
    getDeliveryOptions,
    getNearPostOffices,
    getFAQs
};