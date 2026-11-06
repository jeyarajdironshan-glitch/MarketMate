const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/voice/process-command
 * Natural Language Voice Query Processor for Tamil, Sinhala, and English
 */
router.post('/process-command', authenticate, async (req, res) => {
  try {
    const { transcript, language = 'en' } = req.body;
    if (!transcript) {
      return res.status(400).json({ success: false, message: 'No voice transcript provided.' });
    }

    const cleanText = transcript.trim().toLowerCase();
    console.log(`[Voice Query] Lang: ${language} | Query: "${cleanText}"`);

    let responseText = '';
    let spokenText = '';
    let action = 'info';
    let targetTab = null;
    let dataPayload = null;

    // Detect Commodity names in English, Sinhala, Tamil
    const commodityMap = {
      // Tomato
      'tomato': 'Tomato', 'tomatoes': 'Tomato', 'තක්කාලි': 'Tomato', 'தக்காளி': 'Tomato',
      // Carrot
      'carrot': 'Carrot', 'carrots': 'Carrot', 'කැරට්': 'Carrot', 'கேரட்': 'Carrot',
      // Green Chilli
      'green chilli': 'Green Chilli', 'chilli': 'Green Chilli', 'මිරිස්': 'Green Chilli', 'අමු මිරිස්': 'Green Chilli', 'பச்சை மிளகாய்': 'Green Chilli', 'மிளகாய்': 'Green Chilli',
      // Beans
      'beans': 'Beans (Green)', 'බෝංචි': 'Beans (Green)', 'பீன்ஸ்': 'Beans (Green)',
      // Cabbage
      'cabbage': 'Cabbage', 'ගෝවා': 'Cabbage', 'கோவா': 'Cabbage', 'முட்டைக்கோஸ்': 'Cabbage',
      // Lime
      'lime': 'Lime', 'දෙහි': 'Lime', 'எலுமிச்சை': 'Lime',
      // Leeks
      'leeks': 'Leeks', 'ලීක්ස්': 'Leeks', 'லீக்ஸ்': 'Leeks',
      // Pumpkin
      'pumpkin': 'Pumpkin', 'වට්ටක්කා': 'Pumpkin', 'பூசணிக்காய்': 'Pumpkin',
      // Banana
      'banana': 'Banana (Ambul)', 'කෙසෙල්': 'Banana (Ambul)', 'வாழைப்பழம்': 'Banana (Ambul)',
      // Papaya
      'papaya': 'Papaya', 'පැපොල්': 'Papaya', 'பப்பாளி': 'Papaya'
    };

    let matchedCommodity = null;
    for (const [key, val] of Object.entries(commodityMap)) {
      if (cleanText.includes(key)) {
        matchedCommodity = val;
        break;
      }
    }

    // 1. Price Inquiry Check
    const isPriceQuery = cleanText.includes('price') || cleanText.includes('rate') ||
                         cleanText.includes('මිල') || cleanText.includes('ගණන්') ||
                         cleanText.includes('விலை') || cleanText.includes('ரேட்') ||
                         matchedCommodity !== null;

    if (isPriceQuery && matchedCommodity) {
      const priceRecord = await db.get(`
        SELECT vp.*, cr.report_date
        FROM VegetablePrices vp
        JOIN CBSLPriceReports cr ON vp.report_id = cr.report_id
        WHERE vp.product_name = ? AND vp.report_id = (SELECT MAX(report_id) FROM CBSLPriceReports)
        ORDER BY vp.price_id ASC
        LIMIT 1
      `, [matchedCommodity]);

      if (priceRecord) {
        action = 'navigate_prices';
        targetTab = 'prices';
        dataPayload = priceRecord;

        const changeSign = priceRecord.price_change > 0 ? '+' : '';
        const changeWord = priceRecord.price_change > 0 ? 'increased' : (priceRecord.price_change < 0 ? 'decreased' : 'unchanged');

        if (language === 'si') {
          spokenText = `නවතම ශ්‍රී ලංකා මහ බැංකු වාර්තාවට අනුව ${priceRecord.product_name} කිලෝවක තොග මිල රුපියල් ${priceRecord.price} කි. පෙර මිලට වඩා ${priceRecord.price_change > 0 ? 'රුපියල් ' + priceRecord.price_change + 'කින් වැඩි වී ඇත.' : 'වෙනස් වී ඇත.'}`;
          responseText = `අද CBSL වාර්තාවට අනුව ${priceRecord.product_name} තොග මිල රුපියල් ${priceRecord.price} කි. (${changeSign}${priceRecord.price_change} LKR)`;
        } else if (language === 'ta') {
          spokenText = `இலங்கை மத்திய வங்கி அறிக்கையின்படி ${priceRecord.product_name} ஒரு கிலோ மொத்த விலை ரூபாய் ${priceRecord.price} ஆகும்.`;
          responseText = `இன்றைய CBSL அறிக்கைப்படி ${priceRecord.product_name} மொத்த விலை ரூபாய் ${priceRecord.price} ஆகும். (${changeSign}${priceRecord.price_change} LKR)`;
        } else {
          spokenText = `According to the latest official CBSL report, the wholesale price for ${priceRecord.product_name} at ${priceRecord.market_name} is ${priceRecord.price} Rupees per kilogram.`;
          responseText = `CBSL Reported Price: ${priceRecord.product_name} is Rs. ${priceRecord.price}/kg (${changeSign}Rs. ${priceRecord.price_change}, ${changeSign}${priceRecord.percentage_change}%).`;
        }

        return res.json({ success: true, action, targetTab, spokenText, responseText, dataPayload });
      }
    }

    // 2. Payment Inquiry Check
    const isPaymentQuery = cleanText.includes('payment') || cleanText.includes('money') || cleanText.includes('paid') ||
                           cleanText.includes('ගෙවීම්') || cleanText.includes('මුදල්') || cleanText.includes('සල්ලි') ||
                           cleanText.includes('பணம்') || cleanText.includes('செலுத்துதல்');

    if (isPaymentQuery) {
      action = 'navigate_payments';
      targetTab = 'payments';

      if (req.user.role === 'supplier') {
        const pendingPayments = await db.query(`
          SELECT d.delivery_id, d.product_name, d.total_amount 
          FROM Deliveries d 
          WHERE d.supplier_id = ? AND d.delivery_status IN ('settled', 'pending_review')
        `, [req.supplier.supplier_id]);

        const completedPayments = await db.query(`
          SELECT SUM(amount) as total_received 
          FROM Payments 
          WHERE supplier_id = ? AND payment_status = 'completed'
        `, [req.supplier.supplier_id]);

        const receivedTotal = (completedPayments[0] && completedPayments[0].total_received) ? completedPayments[0].total_received : 0;

        if (language === 'si') {
          spokenText = `ඔබට ලැබී ඇති මුළු ගෙවීම් රුපියල් ${receivedTotal} කි. තහවුරු කළ යුතු ගෙවීම් ${pendingPayments.length} ක් ඇත.`;
          responseText = `ගෙවීම් තත්ත්වය: සම්පූර්ණ කළ ගෙවීම් රු. ${receivedTotal}. බලාපොරොත්තු වන ගෙවීම්: ${pendingPayments.length}.`;
        } else if (language === 'ta') {
          spokenText = `நீங்கள் பெற்ற மொத்த கட்டணம் ரூபாய் ${receivedTotal} ஆகும். நிலுவையில் உள்ள கட்டணங்கள் ${pendingPayments.length} உள்ளன.`;
          responseText = `கட்டண நிலை: பெறப்பட்ட தொகை ரூ. ${receivedTotal}. நிலுவை பதிவுகள்: ${pendingPayments.length}.`;
        } else {
          spokenText = `You have received a total of ${receivedTotal} Rupees in verified payments. You have ${pendingPayments.length} pending settlements under review.`;
          responseText = `Payment Status: Rs. ${receivedTotal} received. ${pendingPayments.length} settlements pending.`;
        }

        return res.json({ success: true, action, targetTab, spokenText, responseText });
      } else if (req.user.role === 'distributor') {
        const pendingPayouts = await db.query(`
          SELECT COUNT(*) as count, SUM(total_amount) as total 
          FROM Deliveries 
          WHERE distributor_id = ? AND delivery_status = 'settled'
        `, [req.distributor.distributor_id]);

        const pendingTotal = (pendingPayouts[0] && pendingPayouts[0].total) ? pendingPayouts[0].total : 0;

        if (language === 'si') {
          spokenText = `ඔබ විසින් සැපයුම්කරුවන්ට ගෙවීමට ඇති මුළු මුදල රුපියල් ${pendingTotal} කි.`;
          responseText = `සැපයුම්කරුවන්ට ගෙවීමට ඇති මුළු ශේෂය: රු. ${pendingTotal}.`;
        } else if (language === 'ta') {
          spokenText = `விநியோகஸ்தர் நிலுவைத் தொகை ரூபாய் ${pendingTotal} ஆகும்.`;
          responseText = `வழங்குநர்களுக்கு செலுத்த வேண்டிய தொகை: ரூ. ${pendingTotal}.`;
        } else {
          spokenText = `You have ${pendingPayouts[0].count} settled deliveries waiting for payment, totaling ${pendingTotal} Rupees.`;
          responseText = `Outstanding payouts to suppliers: Rs. ${pendingTotal}.`;
        }

        return res.json({ success: true, action, targetTab, spokenText, responseText });
      }
    }

    // 3. Market Status Inquiry Check
    const isMarketQuery = cleanText.includes('market') || cleanText.includes('open') || cleanText.includes('close') || cleanText.includes('hours') ||
                          cleanText.includes('වෙළඳපොල') || cleanText.includes('විවෘත') || cleanText.includes('වැසි') ||
                          cleanText.includes('சந்தை') || cleanText.includes('திறப்பு') || cleanText.includes('மூடல்');

    if (isMarketQuery) {
      action = 'navigate_market';
      targetTab = 'market';

      const market = await db.get('SELECT * FROM Markets WHERE market_id = 1'); // Dambulla as primary
      if (language === 'si') {
        spokenText = `${market.market_name} සාමාන්‍ය පරිදි විවෘතයි. වෙළඳ කටයුතු පෙ.ව. ${market.opening_time} සිට ප.ව. ${market.closing_time} දක්වා සිදු කෙරේ.`;
        responseText = `${market.market_name}: තත්ත්වය - ${market.current_status}. වේලාව: ${market.opening_time} - ${market.closing_time}.`;
      } else if (language === 'ta') {
        spokenText = `${market.market_name} தற்போது திறக்கப்பட்டுள்ளது. திறக்கும் நேரம் காலை ${market.opening_time} முதல் மாலை ${market.closing_time} வரை.`;
        responseText = `${market.market_name}: நிலை - ${market.current_status}. நேரம்: ${market.opening_time} - ${market.closing_time}.`;
      } else {
        spokenText = `${market.market_name} is currently ${market.current_status}. Operating hours are from ${market.opening_time} to ${market.closing_time}.`;
        responseText = `${market.market_name} status: ${market.current_status}. Operating hours: ${market.opening_time} - ${market.closing_time}.`;
      }

      return res.json({ success: true, action, targetTab, spokenText, responseText });
    }

    // 4. Delivery Status Inquiry Check
    const isDeliveryQuery = cleanText.includes('delivery') || cleanText.includes('deliveries') ||
                            cleanText.includes('බඩු') || cleanText.includes('ලැබීම්') || cleanText.includes('තොග') ||
                            cleanText.includes('டெலிவரி') || cleanText.includes('விநியோகம்');

    if (isDeliveryQuery) {
      action = 'navigate_deliveries';
      targetTab = 'deliveries';
      if (language === 'si') {
        spokenText = 'ඔබගේ සියලු බෙදාහැරීම් සහ ඩිජිටල් බේරුම්කරණ පත්‍රිකා පෙන්වනු ලැබේ.';
        responseText = 'බෙදාහැරීම් අංශයට යොමු විය.';
      } else if (language === 'ta') {
        spokenText = 'உங்கள் டெலிவரி மற்றும் டிஜிட்டல் ரசீதுகள் காட்டப்படுகின்றன.';
        responseText = 'டெலிவரி பிரிவுக்கு செல்லப்பட்டது.';
      } else {
        spokenText = 'Opening your delivery records and digital settlement slips.';
        responseText = 'Navigated to Delivery Settlements.';
      }
      return res.json({ success: true, action, targetTab, spokenText, responseText });
    }

    // Fallback general guidance
    if (language === 'si') {
      spokenText = `සමාවෙන්න, මට එම විධානය හඳුනාගත නොහැකි විය. කරුණාකර තක්කාලි මිල, ගෙවීම් හෝ වෙළඳපොල තත්ත්වය ගැන අසන්න.`;
      responseText = `විධානය හඳුනාගත නොහැකි විය: "${transcript}". කරුණාකර මිල ගණන්, ගෙවීම් හෝ වෙළඳපොල තත්ත්වය විමසන්න.`;
    } else if (language === 'ta') {
      spokenText = `மன்னிக்கவும், அந்த கட்டளையை புரிந்து கொள்ள முடியவில்லை. தக்காளி விலை அல்லது பணம் பற்றி கேளுங்கள்.`;
      responseText = `கட்டளை புரியவில்லை: "${transcript}". தயவுசெய்து விலை அல்லது பணம் பற்றி கேளுங்கள்.`;
    } else {
      spokenText = `I did not catch that command clearly. You can ask: "What is today's tomato price?", "Show my payments", or "Is the market open?".`;
      responseText = `Command not recognized: "${transcript}". Try asking about prices, payments, or market hours.`;
    }

    res.json({ success: true, action, targetTab, spokenText, responseText });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
