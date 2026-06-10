// api/live.js — Air India Dashboard Serverless Proxy v5
// Vercel Hobby plan compatible (CommonJS)

module.exports = async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { source, route } = req.query;

  try {

    if (source === 'fx') {
      const r = await fetch('https://api.frankfurter.app/latest?from=USD&to=INR,EUR,GBP,AED,SGD');
      return res.status(200).json(await r.json());
    }

    if (source === 'fuel') {
      const EIA_KEY = process.env.EIA_API_KEY;
      if (!EIA_KEY) return res.status(200).json({ jetFuel: 2.65, brent: 82, source: 'fallback' });
      const fuelRes = await fetch('https://api.eia.gov/v2/petroleum/pri/wfr/data/?api_key=' + EIA_KEY + '&frequency=weekly&data[0]=value&facets[product][]=EPD2DXL0&sort[0][column]=period&sort[0][direction]=desc&length=1');
      const fuelData = await fuelRes.json();
      const jetFuel = (fuelData && fuelData.response && fuelData.response.data && fuelData.response.data[0]) ? fuelData.response.data[0].value : 2.65;
      const brentRes = await fetch('https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=' + EIA_KEY + '&frequency=weekly&data[0]=value&facets[product][]=EPCBRENT&sort[0][column]=period&sort[0][direction]=desc&length=1');
      const brentData = await brentRes.json();
      const brent = (brentData && brentData.response && brentData.response.data && brentData.response.data[0]) ? brentData.response.data[0].value : 82;
      return res.status(200).json({ jetFuel: parseFloat(jetFuel), brent: parseFloat(brent) });
    }

    if (source === 'loadfactor') {
      // UPDATE THIS SECTION MONTHLY
      // Source: dgca.gov.in → Statistics → Traffic → Domestic
      return res.status(200).json({
        airIndia: { loadFactor: 86.8, passengers: 4124, month: 'Apr 2026', isActual: true },
        indiGo:   { loadFactor: 88.2, passengers: 9870, month: 'Apr 2026', isActual: true },
        industryAvg: 86.4,
        dataSource: 'DGCA Monthly Domestic Traffic Statistics',
        lastUpdated: 'Apr 2026'
      });
    }

    if (source === 'flights') {
      const user = process.env.OPENSKY_USER;
      const pass = process.env.OPENSKY_PASS;
      if (!user || !pass) return res.status(200).json({ total: 0, airborne: 0, flights: [], source: 'fallback' });
      const auth = Buffer.from(user + ':' + pass).toString('base64');
      const r = await fetch('https://opensky-network.org/api/states/all?icao24=&callsign=AIC', { headers: { 'Authorization': 'Basic ' + auth } });
      const data = await r.json();
      const states = data.states || [];
      const flights = states.map(function(s) { return { callsign: (s[1]||'').trim(), longitude: s[5], latitude: s[6], altitude: s[7], onGround: s[8] }; });
      const airborne = flights.filter(function(f) { return !f.onGround; });
      return res.status(200).json({ total: flights.length, airborne: airborne.length, onGround: flights.length - airborne.length, flights: airborne.slice(0,20), timestamp: new Date().toISOString() });
    }

    if (source === 'route-flights') {
      const user = process.env.OPENSKY_USER;
      const pass = process.env.OPENSKY_PASS;
      if (!user || !pass) return res.status(200).json({ flights: [], source: 'fallback' });
      var IATA = { 'DEL':'VIDP','BOM':'VABB','LHR':'EGLL','DXB':'OMDB','JFK':'KJFK','SIN':'WSSS','FRA':'EDDF','SYD':'YSSY','BLR':'VOBL','HYD':'VOHS','MAA':'VOMM','CCU':'VECC','NRT':'RJTT','HKG':'VHHH','CDG':'LFPG' };
      var parts = (route||'DEL-LHR').split('-');
      var now = Math.floor(Date.now()/1000);
      var auth = Buffer.from(user+':'+pass).toString('base64');
      const r = await fetch('https://opensky-network.org/api/flights/arrival?airport='+(IATA[parts[1]]||'EGLL')+'&begin='+(now-7200)+'&end='+now, { headers: { 'Authorization': 'Basic '+auth } });
      const data = await r.json();
      var relevant = (Array.isArray(data)?data:[]).filter(function(f){return f.estDepartureAirport===(IATA[parts[0]]||'VIDP');}).slice(0,10);
      return res.status(200).json({ route: route||'DEL-LHR', flights: relevant, count: relevant.length, timestamp: new Date().toISOString() });
    }

    if (source === 'carbon') {
      const r = await fetch('https://api.ember-climate.org/v2/carbon-price/latest');
      if (r.ok) return res.status(200).json(await r.json());
      return res.status(200).json({ price: 65, currency: 'EUR', source: 'fallback' });
    }

    if (source === 'ai') {
      const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
      if (!ANTHROPIC_KEY) return res.status(200).json({ content: [{ type: 'text', text: 'ANTHROPIC_API_KEY not configured.' }] });
      const body = await readBody(req);
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body)
      });
      return res.status(200).json(await r.json());
    }

    return res.status(400).json({ error: 'Unknown source: ' + source });

  } catch (err) {
    return res.status(500).json({ error: err.message, source: source, fallback: true });
  }
};

function readBody(req) {
  return new Promise(function(resolve) {
    var body = '';
    req.on('data', function(chunk) { body += chunk.toString(); });
    req.on('end', function() { try { resolve(JSON.parse(body)); } catch(e) { resolve({}); } });
  });
}



