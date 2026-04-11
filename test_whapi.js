require('dotenv').config();
const axios = require('axios');

async function test() {
  const token = process.env.WHAPI_TOKEN;
  const apiUrl = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
  const to = '2349056963124';

  const payloads = [
    {
      to: to,
      type: 'interactive',
      body: { text: "Complete List Payload Test with Type Interactive" },
      action: {
        list: {
          label: "Select List 1",
          sections: [
              {
                  title: "Menu Options",
                  rows: [
                      { id: "opt_1", title: "Option One", description: "First choice" },
                      { id: "opt_2", title: "Option Two" }
                  ]
              }
          ]
        }
      }
    },
    {
      to: to,
      type: "list",
      body: { text: "Type list structure" },
      action: {
        list: {
          label: "Select List 2",
          sections: [
              { title: "Menu Options", rows: [{ id: "opt_1", title: "Option One" }] }
          ]
        }
      }
    }
  ];

  for (let i = 0; i < payloads.length; i++) {
    try {
        console.log(`\nTesting list payload ${i + 1}:`);
        const res = await axios.post(`${apiUrl}/messages/interactive`, payloads[i], {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log("SUCCESS:", JSON.stringify(res.data));
    } catch (e) {
        console.log("ERROR:", JSON.stringify(e.response?.data || e.message));
    }
  }
}

test();
