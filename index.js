'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const api = require('./api');
const token = "EAADAcQndBogBADO4ohIPHjjrglohx1aWEVtaJtTEGFebKIljxJDUxE9kCSCrmkNusof3jjLaxkIIW1O6tEpHS2PWtceyg4GVVV0ZBOQQyIf8gwoYXrcYvUwKHSCzDxnMRMPagXm1uII7b0ccCwvMZA6yJMyPsttKR69vUZASQZDZD";
const striptags = require('striptags');

const app = express();

let db = {};

app.set('port', (process.env.PORT || 5000));
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === 'blondibytes') {
        res.send(req.query['hub.challenge'])
    } else {
        res.send("Wrong token");
    }
});

app.post('/webhook/', function (req, res) {
    let messaging_events = req.body.entry[0].messaging;
    for (let i = 0; i < messaging_events.length; i++) {
        let event = messaging_events[i];
        let sender = event.sender.id;
        db[sender] = db[sender] || {};

        if (event.message && event.message.quick_reply) {
            let { payload } = event.message.quick_reply;

            if (payload === 'parcel') {
                db[sender].action = 'sendparcel';
                sendText(sender, 'What is your sender postcode?');
            } else if (payload === 'faq') {
                db[sender].action = 'faq';
                sendText(sender, "Please provide a keyword in relation to mypost business");
            } else if (payload === 'postOffice') {
                db[sender].action = 'postOffice';
                sendElement(sender, getNearestPostOfficesQuickReplies());
            } else {
                sendSenderAction(sender);

                api.getDeliveryOptions(db[sender].from, db[sender].to, payload).then(function(response) {
                    const price1 = response.data.items[0].prices[0].calculated_price;
                    const price2 = response.data.items[1].prices[0].calculated_price;
                    sendList(sender, getDeliveryOptionsList(sender, price1, price2));
                }).catch(() => {
                    sendText(sender, 'Sorry we can not fetch a price at the moment, please try again later.');
                });
            }
        } else if (event.message && event.message.text) {
            let text = event.message.text;
            if (text.toLowerCase() === 'hi') {
                sendStartingQuickReplies(sender);
            } else if (db[sender].action === 'sendparcel') {
                let postcode = parseInt(text);

                if(db[sender].step === 'starting') {
                    if (postcode) {
                        api.lookupPostcode(postcode).then(function (data) {
                            db[sender].step = 'from';
                            db[sender].from = data.postcode;
                            sendText(sender, 'What is the recipient postcode?')
                        }).catch(() => {
                              sendText(sender, 'I am sorry but this postcode is not available yet, please try another one');
                          });
                    } else {
                        sendText(sender, 'Please provide the post code in the right format');
                    }
                } else if (db[sender].step === 'from') {
                    if (postcode) {
                        api.lookupPostcode(postcode).then(function (data) {
                            db[sender].step = 'to';
                            db[sender].to = data.postcode;
                            sendElement(sender, getPackagingQuickReplies());
                        }).catch(() => {
                            sendText(sender, 'I am sorry but this postcode is not available yet, please try another one');
                        });
                    } else {
                        sendText(sender, 'Please provide the post code in the right format');
                    }
                }
            }  else if (db[sender].action === 'faq') {
                db[sender].step = 'faq';
                api.getFAQs().then( (result) => {
                    let faqs = result.data.faq.results.filter(item => item.question.toLowerCase().includes(text.toLowerCase()));
                    let results = faqs.map((faq) => ({
                        title: faq.question,
                        subtitle:  striptags(faq.answer),
                        buttons: [
                            {
                                type: "phone_number",
                                title: "Call Representative",
                                payload: "+61413868683"
                            }
                        ]
                    }));

                    if(faqs.length > 1) {
                        sendList(sender, results.splice(0,3));
                    } else if (faqs.length === 1) {
                        sendGeneric(sender, results);
                    } else {
                        sendText(sender, 'Sorry there is no results for this question, please try something else');
                    }
                });
            }
        } else if(event.message && event.message.attachments) {
            const attachment = event.message.attachments[0];

            if(attachment.type === 'location') {
                const { lat, long } = attachment.payload.coordinates;

                sendSenderAction(sender);

                api.getNearPostOffices(lat, long)
                  .then((result) => {
                      sendGeneric(sender, getPostOfficesList(result.data, `${lat},${long}`));
                  });
            }
        }
    }

    res.sendStatus(200);
});

app.get('/order', (req, res) => {
    const state = db[req.query.senderId];
    res.redirect(`https://ptest.npe.auspost.com.au/mypost-business/simple-send/?to=${state.to}&from=${state.from}&packagingType=${state.packagingType}&develiveryOption=${req.query.deliveryOption}`);
});

function sendStartingQuickReplies(sender) {
    db[sender].step = 'starting';
    sendElement(sender, getActionQuickReplies());
}

function sendText(sender, text) {
    axios({
        url: "https://graph.facebook.com/v2.6/me/messages",
        params: {access_token: token},
        method: "POST",
        data: {
            recipient: {id: sender},
            message: {text}
        }
    });
}

function getActionQuickReplies() {
    return {
        text: "MyPost Business offers the following services:",
        quick_replies: [
            {
                "content_type": "text",
                "title": "Send a Parcel",
                "payload": "parcel"
            },
            {
                'content_type': 'text',
                'title': 'Find the nearest P.O.',
                'payload': 'postOffice'
            },
            {
                "content_type": "text",
                "title": "FAQ",
                "payload": "faq"
            }
        ]
    };
}

function getPackagingQuickReplies() {
    const packagingOptions = api.getPackagingTypes();
    return {
        text: "Please select your packaging options:",
        quick_replies: packagingOptions.map((packagingType) => ({
            content_type: 'text',
            title: packagingType.label,
            payload: packagingType.id
        }))
    };
}

function getNearestPostOfficesQuickReplies() {
    return {
        text: "Please share your location:",
        quick_replies: [
            {
                'content_type': 'location'
            }
        ]
    }
}

function getDeliveryOptionsList(sender, price1, price2) {
    //TODO: Set DOMREG and DOMEXP dynamiccally.
    return [
        {
            'title': `$${price1}`,
            'image_url': 'https://blooming-anchorage-59177.herokuapp.com/assets/parcel@2x.png',
            'subtitle': 'Standard parcel post',
            'buttons': [
                {
                    'title': 'Use parcel post',
                    'type': 'web_url',
                    'url': `https://blooming-anchorage-59177.herokuapp.com/order?senderId=${sender}&deliveryOption=DOMREG`,
                    'webview_height_ratio': 'full',
                }
            ]
        },
        {
            'title': `$${price2}`,
            'image_url': 'https://blooming-anchorage-59177.herokuapp.com/assets/express@2x.png',
            'subtitle': 'Express post',
            'buttons': [
                {
                    'title': 'Use express post',
                    'type': 'web_url',
                    'url': `https://blooming-anchorage-59177.herokuapp.com/order?senderId=${sender}&deliveryOption=DOMEXP`,
                    'webview_height_ratio': 'full',
                }
            ]
        }
    ];
}

function getPostOfficesList(postOffices, currentUserLocation) {

    return postOffices.map((postOffice) => {
        let address = `${postOffice.address2} ${postOffice.address3}`;
        if(postOffice.address1) {
            address = `${postOffice.address1} ${address}`;
        }
        const hours = postOffice.hoursThisWeek.filter((hours) => hours.hours !== 'Closed').map((hours) => `${hours.days}: ${hours.hours}`).join(' - ');
        const distance = postOffice.distance < 1 ? `${postOffice.distance * 1000}m` : `${postOffice.distance}km`;
        return {
            title: `${postOffice.name} - ${distance}`,
            subtitle: `${address} ${hours}`,
            default_action: {
                type: 'web_url',
                url: `https://www.google.com/maps/dir/${currentUserLocation}/${postOffice.latitude},${postOffice.longitude}`,
                'webview_height_ratio': 'tall',
            },
            "buttons":[
                {
                    type: 'web_url',
                    url: `https://www.google.com/maps/dir/${currentUserLocation}/${postOffice.latitude},${postOffice.longitude}`,
                    title: 'Directions',
                    'webview_height_ratio': 'tall',
                },
                {
                    type: "phone_number",
                    title: "Call",
                    payload: `+61${postOffice.phone_number.replace(' ', '')}`
                }
            ]
        }
    }).splice(0, 3);
}

function sendList(sender, elements) {
    const message = {
        attachment: {
            type: 'template',
            payload: {
                template_type: 'list',
                'top_element_style': 'compact',
                elements
            }
        }
    };

    sendElement(sender, message);
}

function sendGeneric(sender, elements) {
    const message = {
        attachment: {
            type: 'template',
            payload: {
                template_type: 'generic',
                elements
            }
        }
    };

    sendElement(sender, message);
}

function sendElement(sender, message) {
    axios({
        url: "https://graph.facebook.com/v2.6/me/messages",
        params: {access_token: token},
        method: "POST",
        data: {
            recipient: {id: sender},
            message
        }
    }).catch( error => console.log(error));
}

function sendSenderAction(sender) {
    axios({
        url: "https://graph.facebook.com/v2.6/me/messages",
        params: {access_token: token},
        method: "POST",
        data: {
            recipient: {id: sender},
            sender_action: 'typing_on'
        }
    });
}

app.listen(app.get('port'), function () {
    console.log("Running: port", app.get('port'));
});
