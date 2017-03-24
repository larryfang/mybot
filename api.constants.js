const SIMPLESEND_API = 'https://digitalapi-stest.npe.auspost.com.au/simplesend/v1';

module.exports = {
    POSTCODE_API: 'https://digitalapi.auspost.com.au/postcode/search?limit=10&q=',
    POSTCODE_AUTH_KEY: '62b9613ddab3f8cdaf89c47c0234729e',
    PRESENTATION_API: `${SIMPLESEND_API}/accessone/v1/metadata/presentation?country=AU`,
    PRICES_API: `${SIMPLESEND_API}/shipping/v1/prices/items`,
    LOCATION_API: 'http://auspost.com.au/pol/findus/search.json?location=&type=RETAIL&services=&coords=',
    FAQ_API:'https://auspost.com.au/help2/faq/search/'
};