#!/usr/bin/env python3
"""Writes index.html (the public home page) from the content below.

    python3 tools/build-home.py

Keeping the page here means the FAQ on the page and the FAQ in the search-engine data (JSON-LD)
always match. Icons come from assets/icons.svg (Phosphor Icons, duotone, MIT licence).
"""
import html
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://alerts.duniaendelevu.org'
import datetime
MODIFIED = datetime.date.today().isoformat()
E = html.escape


def ic(name, cls='ic'):
    return f'<svg class="{cls}" aria-hidden="true"><use href="/assets/icons.svg#{name}"/></svg>'


ARROW = ic('arrow', 'ic ic--arrow')
CHECK = ic('check', 'ic ic--tick')

# ---------- Why schools: counting cards ----------
STATS = [
    dict(prefix='', value='93', suffix='%', label='<b>Children under 15</b> breathe air dirtier than the WHO guidelines',
         src='WHO, 2018', href='https://www.paho.org/en/news/29-10-2018-more-90-worlds-children-breathe-toxic-air-every-day'),
    dict(prefix='', value='3.7', suffix='×', label='<b>Nairobi’s fine dust</b> over three years, against the WHO yearly guideline',
         src='Environmental Epidemiology, 2024', href='https://pmc.ncbi.nlm.nih.gov/articles/PMC11115977'),
    dict(prefix='', value='131', suffix='K+', label='<b>People forced from home</b> by Kenya’s 2024 floods, which also delayed the school term',
         src='Nation, 2024', href='https://nation.africa/kenya/news/education/cs-machogu-postpones-opening-of-schools-to-may-6-4606688'),
    dict(prefix='~', value='60', suffix='', label='<b>Countries</b> still without warnings for many dangers. The UN aims to cover everyone by 2027',
         src='Climate Home News, 2026', href='https://www.climatechangenews.com/2026/09/23/despite-real-progress-third-of-countries-still-lack-early-warning-systems/'),
]


def stat(s, i):
    pre = f'<span class="metric__u">{E(s["prefix"])}</span>' if s['prefix'] else ''
    suf = f'<span class="metric__u">{E(s["suffix"])}</span>' if s['suffix'] else ''
    return f'''<article class="metric" style="--i:{i}">
        <p class="metric__label">{s["label"]}</p>
        <p class="metric__num">{pre}<span class="metric__v">{E(s["value"])}</span>{suf}</p>
        <a class="metric__src" href="{s["href"]}" rel="noopener">{E(s["src"])}</a>
      </article>'''


# ---------- FAQ (shown on the page and sent to search engines) ----------
FAQ = [
    ('About Dunia Alerts', [
        ('What is Dunia Alerts?',
         'Dunia Alerts is an early warning and learning system for schools in Nairobi, Kenya. It watches air quality, heat, heavy rain and rivers around each school, now and up to 48 hours ahead. The Dunia team checks each warning and sends the head teacher one clear step, parents are told in English and Kiswahili, and every response is recorded. It is a Dunia Endelevu pilot, led by Alana Chelangat.'),
        ('Who is it for?',
         'Learners, teachers and head teachers first. Learners see a simple classroom screen, teachers and head teachers get clear steps, and the Dunia team runs the warnings. Later, researchers, county officials and funders will see class-level summaries only, never information about a single child.'),
        ('Who runs Dunia Alerts?',
         'Dunia Endelevu, a youth-led climate organisation in Kenya founded by Alana Chelangat. The pilot is supported by donors and partners.'),
        ('Is Dunia Alerts free for schools?',
         'Yes. Schools never pay. The pilot is run by Dunia Endelevu and supported by donors.'),
        ('Are there pilot results yet?',
         'Not yet. The dashboard is built and runs on live data, and the first pilot schools are being added. Results, including what did not work, will be published openly.'),
    ]),
    ('Warnings and data', [
        ('What dangers does it warn about?',
         'Unhealthy air (fine dust, PM2.5, of 35.5 µg/m³ or more), heavy rain (30 mm or more in a day), great heat (a high of 30 °C or more) and rising rivers (twice their usual flow), now and up to 48 hours ahead.'),
        ('Where does the data come from?',
         'Weather forecasts from Open-Meteo, air quality from the Copernicus Atmosphere Monitoring Service, river flow from the Global Flood Awareness System, and, where available, ground sensors through OpenAQ, including AirQo sensors in Nairobi. Classroom sensors are the next step.'),
        ('How often is the data updated?',
         'Weather, air and river forecasts are read every 15 minutes. Classroom readings appear as soon as they arrive and pass quality checks. A reading that is too old is marked “Data not current” instead of looking live.'),
        ('Does a computer send the warnings?',
         'No. The dashboard suggests an alert when a reading or forecast crosses a safe level. A person on the Dunia team checks it and decides to send it.'),
        ('How do schools and parents receive alerts?',
         'The head teacher gets a short WhatsApp message or SMS with one clear step. Parents get a ready-made message in English and Kiswahili. Nobody needs to install an app.'),
        ('Does it replace Kenya Meteorological Department warnings?',
         'No. It adds to them. For heavy rain it follows Kenya Meteorological Department advisories, and its job is to help each school act on warnings in time.'),
    ]),
    ('Classroom screen and sensors', [
        ('What is the classroom screen?',
         'A wall screen that shows the room’s fresh air (CO₂), temperature, dust (PM2.5) and humidity, and the weather outside, in English and Kiswahili. A Climate Detective question each day turns the numbers into a class discussion.'),
        ('What sensors will a pilot classroom have?',
         'An indoor sensor for PM2.5, CO₂, temperature and humidity, an outdoor sensor to compare with, a small gateway that stores readings if the internet drops, and a wall screen. Final positions follow a site survey, safe mounting out of children’s reach, and calibration.'),
        ('What happens if a sensor or the internet stops working?',
         'The screen keeps the last valid reading with its time and shows “Data not current” instead of looking live. Readings are kept on the gateway and sent when the connection returns.'),
        ('Does the classroom screen collect anything about children?',
         'No. It shows the room’s temperature, fresh air (CO₂), dust and humidity, and the weather outside. It has no camera or microphone, shows no names and has no controls for learners.'),
        ('Does CO₂ show how well children concentrate?',
         'No. CO₂ shows how fresh the air is, which tells you about ventilation. Any effect on concentration and learning needs a careful study with a trained evaluator.'),
    ]),
    ('From classroom data to policy', [
        ('What data will the pilot collect?',
         'Room conditions (temperature, humidity, CO₂, PM2.5 and how long each stays above a safe level), school-approved attendance and lesson interruptions for the whole class, short voluntary teacher surveys, and the cost of each change. Never children’s names.'),
        ('How will schools use the data to adapt?',
         'To see when and where rooms get too hot, stuffy or dusty, to try changes such as shade, better ventilation, moving PE or adding water breaks, and to check whether conditions really improved.'),
        ('How could the data shape policy?',
         'Class-level and school-level summaries, checked by an independent evaluator, can show county and national education and environment offices what works for schools and what it costs. Wider county or national dashboards come only after the data has been validated.'),
        ('How will you know if it works?',
         'The first study uses one school and two similar classrooms. Both are monitored and kept safe; one also gets shade and ventilation improvements. After a 4 to 6 week baseline, both are followed for at least two school terms, with an independent evaluator. Two classrooms can show whether it is practical and which way things move, not national proof.'),
        ('Can children take part?',
         'Yes. Classes read their own screen and discuss a Climate Detective question every day. A planned feature will let classes share observations and concerns and receive replies from decision-makers.'),
    ]),
    ('Privacy, safety and access', [
        ('What happens to children’s information?',
         'Dunia Alerts never records children’s names. It records what the school did, how fast it replied and whether parents were told. Research data stays at class level, needs school and research approvals, and small groups are never shown in public summaries. The pilot’s records stay on the Dunia team’s devices and in their backups.'),
        ('Is the demo real?',
         'No. The demo uses made-up schools and example data, so anyone can try every step safely. It is clearly marked, and nothing in it is a real reading or a real result.'),
        ('Who can sign in to the live pilot?',
         'The Dunia team running the Nairobi pilot. There is no public sign-up: the team creates each account. Anyone can try the demo without signing in. Lost your password? Write to hello@duniaendelevu.org.'),
    ]),
    ('Support and partners', [
        ('How can I support or partner?',
         'Donate or get in touch through Dunia Endelevu. Support pays for SMS to every parent, classroom sensors, training for head teachers, a login for every school and an open evaluation. Schools, county education offices, weather and air agencies and funders are all welcome.'),
        ('Can another city or school network use it?',
         'We hope so. The forecasts it reads cover the whole world, so the same approach can work elsewhere. Get in touch through Dunia Endelevu and we will share what we learn from the pilot.'),
    ]),
]

LINKS = {'hello@duniaendelevu.org': '<a href="mailto:hello@duniaendelevu.org">hello@duniaendelevu.org</a>',
         'Get in touch through Dunia Endelevu': '<a href="https://duniaendelevu.org/contact">Get in touch through Dunia Endelevu</a>',
         'Donate or get in touch through Dunia Endelevu': '<a href="https://duniaendelevu.org/donate">Donate</a> or <a href="https://duniaendelevu.org/contact">get in touch through Dunia Endelevu</a>'}


def answer_html(a):
    h = E(a, quote=False)
    for k, v in LINKS.items():
        h = h.replace(E(k, quote=False), v)
    return h


def faq_html():
    out = []
    for gi, (group, qs) in enumerate(FAQ):
        items = '\n'.join(f'        <details><summary>{E(q)}</summary><p>{answer_html(a)}</p></details>' for q, a in qs)
        out.append(f'''      <div class="faq__group">
        <h3>{E(group)}</h3>
{items}
      </div>''')
    return '\n'.join(out)


def faq_jsonld():
    return [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for _, qs in FAQ for q, a in qs]


LD = {
    '@context': 'https://schema.org',
    '@graph': [
        {'@type': 'WebSite', '@id': SITE + '/#website', 'url': SITE + '/', 'name': 'Dunia Alerts', 'inLanguage': 'en',
         'publisher': {'@id': 'https://duniaendelevu.org/#organization'}},
        {'@type': 'WebApplication', '@id': SITE + '/#app', 'name': 'Dunia Alerts', 'url': SITE + '/',
         'description': 'Early warning and learning system for schools in Nairobi, Kenya: unhealthy air, heat, heavy rain and rising rivers up to 48 hours ahead, steps for head teachers, messages for parents in English and Kiswahili, and classroom screens.',
         'applicationCategory': 'EducationalApplication', 'operatingSystem': 'Any (web browser)', 'inLanguage': ['en', 'sw'],
         'isAccessibleForFree': True, 'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'KES'},
         'areaServed': {'@type': 'City', 'name': 'Nairobi', 'containedInPlace': {'@type': 'Country', 'name': 'Kenya'}},
         'audience': {'@type': 'EducationalAudience', 'educationalRole': ['teacher', 'student', 'administrator']},
         'publisher': {'@id': 'https://duniaendelevu.org/#organization'}, 'screenshot': SITE + '/og-image.png',
         'image': SITE + '/icon-512.png'},
        {'@type': 'NGO', '@id': 'https://duniaendelevu.org/#organization', 'name': 'Dunia Endelevu', 'url': 'https://duniaendelevu.org/',
         'logo': 'https://duniaendelevu.org/assets/img/icon-512.png',
         'founder': {'@type': 'Person', 'name': 'Alana Chelangat', 'url': 'https://alanachelangat.com/'}, 'areaServed': 'Kenya'},
        {'@type': 'WebPage', '@id': SITE + '/#webpage', 'url': SITE + '/', 'name': 'Dunia Alerts · Early warnings for schools in Nairobi, Kenya',
         'isPartOf': {'@id': SITE + '/#website'}, 'about': {'@id': SITE + '/#app'}, 'inLanguage': 'en', 'dateModified': MODIFIED,
         'primaryImageOfPage': {'@type': 'ImageObject', 'url': SITE + '/og-image.png', 'width': 1200, 'height': 630},
         'speakable': {'@type': 'SpeakableSpecification', 'cssSelector': ['.h1', '.lede']}},
        {'@type': 'FAQPage', '@id': SITE + '/#faq', 'isPartOf': {'@id': SITE + '/#website'}, 'mainEntity': faq_jsonld()},
    ],
}

# ---------- Page ----------
PAGE = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Dunia Alerts · Early warnings for schools in Nairobi, Kenya</title>
<meta name="description" content="Dunia Alerts warns Nairobi schools about unhealthy air, heat, heavy rain and rising rivers up to 48 hours ahead, and helps head teachers act in time. Try the free demo.">
<link rel="canonical" href="https://alerts.duniaendelevu.org/">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta name="theme-color" content="#F2F3F1">
<meta name="author" content="Dunia Endelevu">
<meta name="geo.region" content="KE-30">
<meta name="geo.placename" content="Nairobi">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Dunia Alerts">
<meta property="og:title" content="Dunia Alerts · Early warnings that reach children at school">
<meta property="og:description" content="Air, heat, rain and river warnings for Nairobi schools, one clear step for the head teacher, messages for parents in English and Kiswahili, and classroom screens that help schools adapt.">
<meta property="og:url" content="https://alerts.duniaendelevu.org/">
<meta property="og:image" content="https://alerts.duniaendelevu.org/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Dunia Alerts: early warnings that reach children at school, with the dashboard showing alerts for Nairobi schools.">
<meta property="og:locale" content="en_KE">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Dunia Alerts · Early warnings that reach children at school">
<meta name="twitter:description" content="Air, heat, rain and river warnings for Nairobi schools, and classroom screens that help schools adapt. A Dunia Endelevu pilot.">
<meta name="twitter:image" content="https://alerts.duniaendelevu.org/og-image.png">
<meta name="twitter:image:alt" content="Dunia Alerts: early warnings that reach children at school, shown on a laptop.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/assets/fonts/inter-tight-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" as="image" type="image/avif" imagesrcset="__HERO_SRCSET__" imagesizes="__HERO_SIZES__" fetchpriority="high">
<link rel="stylesheet" href="/assets/site.css">
<script src="/assets/site.js" defer></script>
<script type="application/ld+json">__LD__</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>

<header class="nav">
  <div class="nav__bar">
    <a class="brand" href="/" aria-label="Dunia Alerts home"><span class="brand__mark" aria-hidden="true"></span>Dunia <span class="brand__sub">Alerts</span></a>
    <nav class="nav__links" aria-label="Sections">
      <a href="#how">How it works</a>
      <a href="#dashboard">Dashboard</a>
      <a href="#classroom">Classroom</a>
      <a href="#evidence">Evidence</a>
      <a href="#faq">FAQ</a>
    </nav>
    <div class="nav__end">
      <a class="nav__signin" href="/login">Sign in</a>
      <a class="btn btn--dark btn--sm" href="/demo"><span class="nav__long">See the demo</span><span class="nav__short">Demo</span></a>
    </div>
  </div>
</header>

<div class="frame">
<main id="main">

  <section class="hero" aria-labelledby="top">
    <a class="badge" href="#classroom"><b>New</b>Meet the classroom screen__ARROW__</a>
    <h1 class="h1" id="top">Early warnings that reach children <span class="hl">at school</span></h1>
    <p class="lede">Dunia Alerts watches the air, heat, heavy rain and rivers around schools in Nairobi, Kenya, up to 48 hours ahead. When danger is coming, the head teacher gets one clear step, and parents hear it in English and Kiswahili.</p>
    <div class="btns">
      <a class="btn btn--dark" href="/demo">See the demo__ARROW__</a>
      <a class="btn btn--light" href="/login">__LOCK__Pilot sign in</a>
    </div>
    <p class="micro">Free for schools · No app to install · A Dunia Endelevu pilot</p>

    <div class="shot">
      <span class="chip chip--a"><span class="chip__ico" style="--c:var(--accent)">__IC_early__</span>Up to 48 hours ahead</span>
      <span class="chip chip--b"><span class="chip__ico" style="--c:var(--rain)">__IC_decide__</span>A person checks every alert</span>
      __LAPTOP_HERO__
    </div>
  </section>

  <div class="strip">
    <span class="strip__label">Reads open data from</span>
    <ul class="strip__list">
      <li>Open-Meteo</li>
      <li>Copernicus CAMS</li>
      <li>GloFAS</li>
      <li>OpenAQ</li>
      <li>AirQo</li>
      <li>US EPA AQI</li>
    </ul>
  </div>

  <section class="sec" id="why" aria-labelledby="why-h">
    <span class="kicker">Why schools</span>
    <h2 class="sr" id="why-h">Why early warnings must reach schools</h2>
    <p class="sentence">Children feel <span class="nw"><span class="tag" style="--c:var(--air)">__IC_air__dirty air</span>,</span> <span class="tag" style="--c:var(--heat)">__IC_heat__heat</span> and <span class="tag" style="--c:var(--rain)">__IC_rain__floods</span> first, and on weekdays most of them are at <span class="nw"><span class="tag" style="--c:var(--accent)">__IC_school__school</span>.</span> <span class="soft">A warning that never reaches the school never reaches them.</span></p>
    <div class="metrics">
      __STATS__
    </div>
  </section>

  <section class="sec center" id="how" aria-labelledby="how-h">
    <span class="kicker">How it works</span>
    <h2 class="h2" id="how-h">From a forecast to a safe school day.</h2>
    <p class="sub">Every 15 minutes, for every pilot school.</p>
    <ol class="steps">
      <li class="step"><span class="step__n">01</span><span class="tile">__IC_watch__</span><h3>Watch</h3><p>The dashboard reads air quality, weather and river forecasts for each school.</p></li>
      <li class="step"><span class="step__n">02</span><span class="tile">__IC_early__</span><h3>Spot it early</h3><p>It flags danger now and up to 48 hours ahead: dirty air, heavy rain, great heat or a rising river.</p></li>
      <li class="step"><span class="step__n">03</span><span class="tile">__IC_decide__</span><h3>A person decides</h3><p>The Dunia team checks it, then sends the head teacher a short WhatsApp or SMS with one clear step.</p></li>
      <li class="step"><span class="step__n">04</span><span class="tile">__IC_learn__</span><h3>Act and learn</h3><p>The school acts, parents are told, and every response is timed and recorded for the pilot report.</p></li>
    </ol>
  </section>

  <section class="sec center" id="dashboard" aria-labelledby="dash-h">
    <span class="kicker">The dashboard</span>
    <h2 class="h2" id="dash-h">Everything the team needs, from warning to follow-up.</h2>
    <p class="sub">The demo has made-up schools, so anyone can try every step. The live pilot uses the same screens with real readings.</p>
    <div class="tabs" role="tablist" aria-label="Dashboard screens">
      <button type="button" role="tab" id="t-overview" aria-controls="p-overview" aria-selected="true">__IC_overview__Overview</button>
      <button type="button" role="tab" id="t-desk" aria-controls="p-desk" aria-selected="false" tabindex="-1">__IC_desk__School desk</button>
      <button type="button" role="tab" id="t-parents" aria-controls="p-parents" aria-selected="false" tabindex="-1">__IC_parents__Parents</button>
      <button type="button" role="tab" id="t-impact" aria-controls="p-impact" aria-selected="false" tabindex="-1">__IC_impact__Impact</button>
    </div>
__PANELS__
  </section>

  <section class="sec center" id="watch" aria-labelledby="watch-h">
    <span class="kicker">What it watches</span>
    <h2 class="h2" id="watch-h">Four dangers. One clear line for each.</h2>
    <p class="sub">When a reading or forecast crosses the line, the team is asked to check it.</p>
    <div class="hazards">
__HAZARDS__
    </div>
  </section>

  <section class="sec" id="classroom" aria-labelledby="room-h">
    <div class="split">
      <div>
        <span class="kicker">New · Classroom screen</span>
        <h2 class="h2" id="room-h">The warning, inside the room where children learn.</h2>
        <p class="sub sub--left">A wall screen shows the classroom’s fresh air, temperature, dust and humidity, and the weather outside, in English and Kiswahili.</p>
        <ul class="ticks">
          <li>__CHECK__<span><b>Built.</b> The screen, and a secure link for indoor sensors that checks every reading before it is shown.</span></li>
          <li>__CHECK__<span><b>Honest by design.</b> When readings are old, it says “Data not current” instead of looking live.</span></li>
          <li>__CHECK__<span><b>A lesson every day.</b> A Climate Detective question turns the numbers into a class discussion.</span></li>
          <li>__CHECK__<span><b>Next, with funding.</b> Sensors in two pilot classrooms, one with better shade and ventilation, compared over two school terms.</span></li>
        </ul>
        <div class="btns btns--left">
          <a class="btn btn--light" href="/classroom?demo=1">Open the classroom screen__ARROW__</a>
        </div>
      </div>
      <figure class="split__shot">
        <div class="wall">
          __WHITEBOARD__
        </div>
        <figcaption class="panel__cap">Example data, not real readings</figcaption>
      </figure>
    </div>
  </section>

  <section class="sec center" id="evidence" aria-labelledby="ev-h">
    <span class="kicker">Where it’s going</span>
    <h2 class="h2" id="ev-h">From a classroom reading to a better policy.</h2>
    <p class="sub">Dunia Alerts is growing from warnings into evidence: measure each classroom, act on it, learn what works, and give the people who decide proof they can trust.</p>

    <ol class="flow">
      <li class="flow__step"><span class="flow__n">01</span><span class="tile">__IC_measure__</span><h3>Measure</h3><p>Indoor and outdoor readings: PM2.5, CO₂, temperature and humidity, each with its time and a quality check.</p><span class="state state--next">Sensors next</span></li>
      <li class="flow__step"><span class="flow__n">02</span><span class="tile">__IC_interpret__</span><h3>Interpret</h3><p>Screens for learners and teachers: today’s conditions, trends and a question to talk about.</p><span class="state state--built">Classroom screen built</span></li>
      <li class="flow__step"><span class="flow__n">03</span><span class="tile">__IC_act__</span><h3>Act</h3><p>A person approves each alert. The school’s response is timed and kept in a record that can’t be changed.</p><span class="state state--live">Live now</span></li>
      <li class="flow__step"><span class="flow__n">04</span><span class="tile">__IC_prove__</span><h3>Prove</h3><p>Compare classrooms over two terms with an independent evaluator, then share class-level evidence with counties and funders.</p><span class="state">Planned</span></li>
    </ol>

    <div class="goals">
      <article class="goal">
        <span class="goal__n">01</span><span class="tile tile--lg">__IC_sensor__</span>
        <h3>Environmental monitoring in schools</h3>
        <p>Open, digitised readings from every pilot classroom, with live dashboards that students read, question and help collect.</p>
      </article>
      <article class="goal">
        <span class="goal__n">02</span><span class="tile tile--lg">__IC_voice__</span>
        <h3>Children’s voices in environmental decisions</h3>
        <p>A simple, structured way for classes to raise concerns, share their own observations and get answers back from decision-makers.</p>
      </article>
      <article class="goal">
        <span class="goal__n">03</span><span class="tile tile--lg">__IC_wellbeing__</span>
        <h3>Climate adaptation and learner wellbeing</h3>
        <p>Study how heat and classroom air affect attendance, concentration and the school day, and which changes help most for the money.</p>
      </article>
    </div>

    <div class="collect">
      <div class="collect__head">
        <h3>What the pilot will measure</h3>
        <p>Class-level only. Never children’s names.</p>
      </div>
      <ul class="pills">
        <li>__IC_heat__Temperature</li>
        <li>__IC_fan__Fresh air (CO₂)</li>
        <li>__IC_air__Dust (PM2.5)</li>
        <li>__IC_humidity__Humidity</li>
        <li>__IC_time__Time above safe levels</li>
        <li>__IC_attendance__Attendance</li>
        <li>__IC_desk__Lessons interrupted</li>
        <li>__IC_comfort__Teacher comfort</li>
        <li>__IC_cost__Cost per classroom</li>
      </ul>
    </div>

    <div class="roles">
      <div class="role"><span class="tile">__IC_learners__</span><div><h3>Learners</h3><p>Live conditions, simple explanations and a daily question.</p></div></div>
      <div class="role"><span class="tile">__IC_teachers__</span><div><h3>Teachers</h3><p>Clear steps, trends and a quick way to note what helped.</p></div></div>
      <div class="role"><span class="tile">__IC_school__</span><div><h3>Head teachers</h3><p>Every room, every alert and every fix in one place.</p></div></div>
      <div class="role"><span class="tile">__IC_policy__</span><div><h3>Policy and funders</h3><p>Checked, class-level summaries and costs. No child-level data.</p></div></div>
    </div>

    <aside class="plan">
      <span class="plan__tag">The plan, not a result</span>
      <p>One school, two similar classrooms. Both are monitored and kept safe; one also gets shade and better ventilation. After a 4 to 6 week baseline, both are followed for at least two school terms, with an independent evaluator. Two classrooms can show whether this is practical and which way things move, not national proof. CO₂ shows how fresh the air is, not how well children think.</p>
    </aside>
  </section>

  <section class="sec center" id="trust" aria-labelledby="trust-h">
    <span class="kicker">Built to be trusted</span>
    <h2 class="h2" id="trust-h">Careful by design.</h2>
    <div class="trust">
      <div><span class="tile">__IC_decide__</span><h3>A person always decides</h3><p>The computer suggests. The Dunia team checks and sends.</p></div>
      <div><span class="tile">__IC_data__</span><h3>Open data</h3><p>Every reading says where it came from: a ground sensor, a model or the team.</p></div>
      <div><span class="tile">__IC_languages__</span><h3>Two languages</h3><p>Every parent message is in English and Kiswahili.</p></div>
      <div><span class="tile">__IC_privacy__</span><h3>No children’s names</h3><p>Only what the school did, how fast it replied and whether parents were told.</p></div>
      <div><span class="tile">__IC_phone__</span><h3>Free for schools</h3><p>Schools never pay. It works on any phone, with no app to install.</p></div>
      <div class="status"><span class="dot">Status</span><div><h3>Built and live. Pilot starting in Nairobi.</h3><p>The dashboard runs on live data today, and the team is adding the first pilot schools. Results will be published openly.</p></div></div>
    </div>
  </section>

  <section class="sec center" id="access" aria-labelledby="access-h">
    <span class="kicker">Two ways in</span>
    <h2 class="h2" id="access-h">Look around, or get to work.</h2>
    <div class="ways">
      <article class="way">
        <span class="way__tag">Open to everyone</span>
        <h3>Demo</h3>
        <p>Made-up schools and example data. Try every step, from a warning to the pilot report.</p>
        <ul class="ticks">
          <li>__CHECK__No sign-in needed</li>
          <li>__CHECK__Start over any time</li>
          <li>__CHECK__Clearly marked as example data</li>
        </ul>
        <a class="btn btn--dark btn--block" href="/demo">See the demo__ARROW__</a>
      </article>
      <article class="way way--pilot">
        <span class="way__tag">__LOCK__For the Dunia team</span>
        <h3>Live pilot</h3>
        <p>Live readings and forecasts for the pilot schools, and the records the team keeps.</p>
        <ul class="ticks">
          <li>__CHECK__Private sign-in, checked on the server</li>
          <li>__CHECK__Each step records who took it</li>
          <li>__CHECK__Signs out after 12 hours</li>
        </ul>
        <a class="btn btn--light btn--block" href="/login">__LOCK__Pilot sign in</a>
      </article>
    </div>
    <p class="micro">No public sign-up. The Dunia team creates each account.</p>
  </section>

  <section class="sec sec--tight" aria-labelledby="fund-h">
    <div class="band">
      <div>
        <h2 id="fund-h">Help a warning reach every child.</h2>
        <p>The data is free. People, phones and sensors are not. Support pays for SMS to every parent, classroom sensors, training for head teachers, a login for every school and an open evaluation.</p>
      </div>
      <div class="btns">
        <a class="btn btn--light" href="https://duniaendelevu.org/donate">Donate</a>
        <a class="btn btn--ghost" href="https://duniaendelevu.org/contact">Partner with us</a>
      </div>
    </div>
  </section>

  <section class="sec" id="faq" aria-labelledby="faq-h">
    <div class="faq-head center">
      <span class="kicker">FAQ</span>
      <h2 class="h2" id="faq-h">Questions, answered.</h2>
      <p class="sub">Everything about the warnings, the classroom screen, the data and the pilot. Still curious? Write to <a href="mailto:hello@duniaendelevu.org">hello@duniaendelevu.org</a>.</p>
    </div>
    <div class="faq">
__FAQ__
    </div>
  </section>

</main>

<footer class="foot">
  <div>
    <a class="brand" href="/" aria-label="Dunia Alerts home"><span class="brand__mark" aria-hidden="true"></span>Dunia <span class="brand__sub">Alerts</span></a>
    <p>A <a href="https://duniaendelevu.org/">Dunia Endelevu</a> pilot, led by <a href="https://alanachelangat.com/">Alana Chelangat</a>.</p>
  </div>
  <nav aria-label="Footer">
    <a href="/demo">Demo</a>
    <a href="/classroom?demo=1">Classroom screen</a>
    <a href="/login">Pilot sign in</a>
    <a href="https://duniaendelevu.org/contact">Contact</a>
    <a href="https://duniaendelevu.org/donate">Donate</a>
  </nav>
  <p class="foot__note">Data: Open-Meteo (weather, Copernicus CAMS air, GloFAS rivers) and OpenAQ. Air bands: US EPA AQI (2024). Icons: Phosphor. © <span data-year>2026</span> Dunia Endelevu.</p>
</footer>
</div>
</body>
</html>
'''

PANELS = [
    ('overview', 'Every school, at a glance.', ['Readings and forecasts for each school, refreshed every 15 minutes.', 'Warnings up to 48 hours ahead, with when the danger is expected.', 'Prepare an alert or dismiss it, once a person has checked.'],
     'monitor', 'monitor-overview', 'The overview on a desktop screen, with example data: a 3D map of air at each school, where column height is fine dust, and the selected school’s air now, last 24 hours and next 48 hours.', 'Demo · made-up schools and example data'),
    ('desk', 'One clear step for the head teacher.', ['Message the head teacher on WhatsApp or SMS in one tap.', 'Record the reply, how fast it came and what the school did.', 'Notes never hold pupils’ names.'],
     'laptop', 'desk-laptop', 'The school desk on a laptop, with example data: an unhealthy air alert, the step for the school, and a timeline from alert sent to the head teacher’s reply.', 'Demo · made-up schools and example data'),
    ('parents', 'Parents hear it in two languages.', ['Ready-made messages in English and Kiswahili.', 'SMS length counted, so the cost is clear before sending.', 'Mark parents as told, for the pilot record.'],
     'phone', 'parents', '', 'Example message from the demo'),
    ('impact', 'Every response, timed and recorded.', ['Response rates and trends, from warning to action.', 'Stories from the record and results by school.', 'Indicators for counties, ministries, NGOs and funders, with CSV and PDF.'],
     'monitor', 'monitor-impact', 'The impact screen on a desktop screen, with example data: pupil-days protected, schools, learners and warnings sent, then response rates with trend lines.', 'Demo · example numbers, not pilot results'),
]


MOCK = {  # photo mockups with the real screens composited in (assets/mock): widths made, and the size of the largest
    'hero-laptop': ([640, 960, 1280, 1800], 1800, 1275),
    'desk-laptop': ([480, 720, 1080, 1400], 1400, 1143),
    'monitor-overview': ([480, 720, 1080, 1400], 1400, 1000),
    'monitor-impact': ([480, 720, 1080, 1400], 1400, 1000),
    'whiteboard': ([480, 720, 1080, 1400], 1400, 1015),
    'phone-frame': ([300, 600, 824], 824, 1732),
}


def ver(name):
    """A short fingerprint of an image's current files, added to its address so browsers fetch a new version
    as soon as it changes (the images themselves can then be cached for a long time)."""
    import hashlib
    h = hashlib.sha1()
    for w in MOCK[name][0]:
        for ext in ('avif', 'webp'):
            with open(os.path.join(ROOT, 'assets', 'mock', f'{name}-{w}.{ext}'), 'rb') as f:
                h.update(f.read())
    return h.hexdigest()[:8]


def srcset(name, ext):
    v = ver(name)
    return ', '.join(f'/assets/mock/{name}-{w}.{ext}?v={v} {w}w' for w in MOCK[name][0])


def photo(name, alt, sizes, eager=False, cls='photo'):
    widths, w, h = MOCK[name]
    fallback = widths[-2] if len(widths) > 1 else widths[-1]
    load = 'fetchpriority="high" decoding="async"' if eager else 'loading="lazy" decoding="async"'
    return (f'<picture><source type="image/avif" srcset="{srcset(name, "avif")}" sizes="{sizes}">'
            f'<source type="image/webp" srcset="{srcset(name, "webp")}" sizes="{sizes}">'
            f'<img class="{cls}" src="/assets/mock/{name}-{fallback}.webp?v={ver(name)}" width="{w}" height="{h}" {load} alt="{E(alt)}"></picture>')


HERO_SIZES = '(max-width: 560px) calc(100vw - 72px), (max-width: 1080px) calc(100vw - 140px), 940px'
PANEL_SIZES = '(max-width: 560px) calc(100vw - 80px), (max-width: 980px) calc(100vw - 160px), 560px'


EN_MSG = 'Dunia Alerts: Air near Neema Junior School is unhealthy today. PE and outdoor games are moving indoors. Please send your child’s inhaler if they use one.'
SW_MSG = 'Dunia Alerts: Hewa karibu na Neema Junior School si salama leo. Michezo na masomo ya nje yatafanyika ndani. Tafadhali mpe mtoto wako dawa yake ya pumu kama anaitumia.'


def phone():
    return f'''<div class="handset" role="img" aria-label="A parent’s phone receiving the Dunia Alerts message by SMS, in English and Kiswahili. Example message from the demo.">
          {photo('phone-frame', '', '300px', cls='handset__frame')}
          <div class="hs" aria-hidden="true">
            <div class="hs-status"><span>07:52</span><span><b></b><i></i></span></div>
            <div class="hs-notif"><span class="hs-av"></span><b>Dunia Alerts <span>now</span></b><p>{E(EN_MSG)}</p></div>
            <div class="hs-head"><span class="hs-av"></span><b>Dunia Alerts</b><span>Text message</span></div>
            <div class="hs-body">
              <span class="hs-day">Today 07:52</span>
              <p class="hs-msg"><small>English</small>{E(EN_MSG)}</p>
              <p class="hs-msg"><small>Kiswahili</small>{E(SW_MSG)}</p>
              <span class="hs-sent">Delivered</span>
            </div>
            <div class="hs-input">Text message<i></i></div>
          </div>
        </div>'''


def panel(i, p):
    v, h3, ticks, dev, shot, alt, cap = p
    device = phone() if dev == 'phone' else photo(shot, alt, PANEL_SIZES)
    hidden = '' if i == 0 else ' hidden'
    lis = '\n'.join(f'          <li>{CHECK}{E(t)}</li>' for t in ticks)
    return f'''    <div class="panel" role="tabpanel" id="p-{v}" aria-labelledby="t-{v}" tabindex="0"{hidden}>
      <div>
        <span class="tile tile--lg">{ic(v)}</span>
        <h3>{E(h3)}</h3>
        <ul class="ticks">
{lis}
        </ul>
        <a class="more" href="/demo#{v}">Open it in the demo{ARROW}</a>
      </div>
      <figure>
        {f'<div class="stage stage--mint">{device}</div>' if dev == 'phone' else device}
        <figcaption class="panel__cap">{E(cap)}</figcaption>
      </figure>
    </div>'''


HAZARDS = [
    ('air', 'var(--air)', 'Unhealthy air', 'PM2.5 ≥ 35.5 µg/m³', 'PE indoors; children with asthma stay inside.', 'Copernicus CAMS · ground sensors'),
    ('rain', 'var(--rain)', 'Heavy rain', '≥ 30 mm in a day', 'Away from drains; a safe early release.', 'Open-Meteo · Kenya Met Department'),
    ('heat', 'var(--heat)', 'Great heat', 'A high of 30 °C or more', 'Water breaks, shade, and PE early in the day.', 'Open-Meteo forecast'),
    ('river', 'var(--river)', 'Rising river', 'Twice its usual flow', 'Check routes home; plan the release.', 'Global Flood Awareness System'),
]


def hazard(h):
    k, c, t, when, p, src = h
    return f'''      <article class="hz" style="--c:{c}">
        <span class="tile tile--lg">{ic(k)}</span>
        <h3>{E(t)}</h3>
        <div class="hz__when">{E(when)}</div>
        <p>{E(p)}</p>
        <small>{E(src)}</small>
      </article>'''


def llms_full():
    out = ['# Dunia Alerts: full guide', '',
           '> Early warnings for schools in Nairobi, Kenya, and the start of climate-smart classrooms. Dunia Alerts watches air quality (PM2.5), heat, heavy rain and river flow around pilot schools, up to 48 hours ahead. A person on the Dunia team checks each warning and sends the head teacher one clear step; parents are told in English and Kiswahili. A Dunia Endelevu pilot, led by Alana Chelangat.', '',
           'Website: https://alerts.duniaendelevu.org/  ·  Demo with example data: https://alerts.duniaendelevu.org/demo  ·  Classroom screen (example data): https://alerts.duniaendelevu.org/classroom?demo=1', '',
           '## Why schools', '']
    for st in STATS:
        import re as _re
        label = _re.sub(r'<[^>]+>', '', st['label'])
        out.append(f"- {st['prefix']}{st['value']}{st['suffix']}: {label} ({st['src']}, {st['href']})")
    out += ['', '## How it works', '', '1. Watch: the dashboard reads air quality, weather and river forecasts for each school every 15 minutes.',
            '2. Spot it early: it flags danger now and up to 48 hours ahead.', '3. A person decides: the Dunia team checks, then sends the head teacher a short WhatsApp or SMS with one clear step.',
            '4. Act and learn: the school acts, parents are told, and every response is timed and recorded.', '',
            '## Alert levels', '']
    for h in HAZARDS:
        out.append(f'- {h[2]}: {h[3]}. School step: {h[4]} Data: {h[5]}.')
    out += ['', '## Where it is going (planned, not results)', '',
            '- Measure: indoor and outdoor PM2.5, CO₂, temperature and humidity, with quality checks.',
            '- Interpret: screens for learners and teachers.', '- Act: human-approved alerts and a record that cannot be changed.',
            '- Prove: compare classrooms over two terms with an independent evaluator, then share class-level evidence with county and national offices and funders.',
            '- Aims: environmental monitoring in schools; a way for children to raise environmental concerns and get answers from decision-makers; studying how heat and classroom air affect attendance, concentration and the school day.', '',
            '## Questions and answers', '']
    for group, qs in FAQ:
        out += [f'### {group}', '']
        for q, a in qs:
            out += [f'**{q}**', a, '']
    return '\n'.join(out).rstrip() + '\n'


def build():
    page = PAGE
    page = page.replace('__LD__', json.dumps(LD, ensure_ascii=False, indent=1))
    page = page.replace('__STATS__', '\n      '.join(stat(s, i) for i, s in enumerate(STATS)))
    page = page.replace('__PANELS__', '\n'.join(panel(i, p) for i, p in enumerate(PANELS)))
    page = page.replace('__HAZARDS__', '\n'.join(hazard(h) for h in HAZARDS))
    page = page.replace('__FAQ__', faq_html())
    page = page.replace('__HERO_SRCSET__', srcset('hero-laptop', 'avif')).replace('__HERO_SIZES__', HERO_SIZES)
    page = page.replace('__WHITEBOARD__', photo('whiteboard', 'The classroom screen on a classroom whiteboard, with example data: ‘Our classroom is ready for learning’, tiles for temperature, fresh air, dust and humidity, each with a three-step meter, the weather outside and a Climate Detective question.', PANEL_SIZES, cls='board-img'))
    page = page.replace('__LAPTOP_HERO__', photo('hero-laptop', 'A laptop held in one hand, showing the Dunia Alerts overview with example data: open alerts, the worst air now, warnings for the next 48 hours and a list of schools that need attention.', HERO_SIZES, eager=True, cls='photo photo--hero'))
    page = page.replace('__ARROW__', ARROW).replace('__CHECK__', CHECK).replace('__LOCK__', ic('lock'))
    import re
    page = re.sub(r'__IC_([a-z]+)__', lambda m: ic(m.group(1)), page)
    left = re.findall(r'__[A-Z][A-Za-z_]*__', page)
    assert not left, left
    with open(os.path.join(ROOT, 'index.html'), 'w') as f:
        f.write(page)
    with open(os.path.join(ROOT, 'llms-full.txt'), 'w') as f:
        f.write(llms_full())
    print('Wrote index.html and llms-full.txt ·', sum(len(q) for _, q in FAQ), 'questions')


if __name__ == '__main__':
    build()
