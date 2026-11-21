/**
 * ============================================================================
 * RentA — Script de Populare Date Virtuale (50 Utilizatori + 100 Anunțuri)
 * ============================================================================
 *
 * Acest script generează și populează în Supabase:
 *   - 50 de utilizatori virtuali (32 Personal / individual + 18 Business / company)
 *     distribuiți în 8 orașe mari din România (București, Cluj, Timișoara, etc.)
 *     cu parola universală de testare: DemoRentA2026!
 *   - 100 de anunțuri fictive distribuite pe cele 8 categorii oficiale:
 *     (scule-unelte, foto-video, camping-outdoor, evenimente-party, electronice,
 *      vestimentar, sport-timp-liber, altele)
 *     fiecare cu preț / zi, garanție, politică de anulare și 2-3 imagini foto
 *     de înaltă rezoluție (Unsplash) în tabelul `public.listing_images`.
 *
 * Rulare: `node scripts/seed-virtual-data.mjs`
 * ============================================================================
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xnhbjhynophktcygfijo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Su3R4qM-kczrSFDmL6LqBg_KAJ-Q_xH";
const DEMO_PASSWORD = "DemoRentA2026!";

// Utilitar de întârziere pentru a nu supraîncărca API-ul
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// 1. DEFINIȚIE 50 UTILIZATORI VIRTUALI (32 Personal + 18 Business)
// ============================================================================
const USERS_DATA = [
  // --- BUCUREȘTI (16 utilizatori: 10 Personal + 6 Business) ---
  {
    email: "andrei.radulescu@renta-demo.ro",
    displayName: "Andrei Rădulescu",
    accountType: "individual",
    city: "București",
    bio: "Pasionat de fotografie urbană și drumeții montane. Închiriez echipamente bine întreținute în zona Titan/Dristor.",
  },
  {
    email: "contact@prosound-events.ro",
    displayName: "ProSound & Events SRL",
    accountType: "company",
    companyCui: "RO39281740",
    city: "București",
    bio: "Firmă de logistică evenimente, sunet și lumini scenă. Factură fiscală cu TVA și echipamente de scenă profesionale.",
  },
  {
    email: "ioana.vasilescu@renta-demo.ro",
    displayName: "Ioana Vasilescu",
    accountType: "individual",
    city: "București",
    bio: "Arhitect de interior. Pun la dispoziție instrumente de măsurare laser, nivele și echipamente foto de prezentare.",
  },
  {
    email: "florin.dumitrescu@renta-demo.ro",
    displayName: "Florin Dumitrescu",
    accountType: "individual",
    city: "București",
    bio: "Meșter amator, pasionat de bricolaj și restaurare mobilier vechi. Scule electrice de top verificate periodic.",
  },
  {
    email: "contact@cinegear-rentals.ro",
    displayName: "CineGear Rentals SRL",
    accountType: "company",
    companyCui: "RO41920831",
    city: "București",
    bio: "Casă de închirieri echipamente video cinematografice, camere 6K/8K, gimbale profesionale și car-rigs.",
  },
  {
    email: "diana.tudor@renta-demo.ro",
    displayName: "Diana Tudor",
    accountType: "individual",
    city: "București",
    bio: "Organizatoare de evenimente private. Închiriez accesorii festive, suporturi de deserturi și veselă vintage.",
  },
  {
    email: "cristian.stan@renta-demo.ro",
    displayName: "Cristian Stan",
    accountType: "individual",
    city: "București",
    bio: "Ciclist urban și pasionat de trasee gravel. Închiriez biciclete electrice și suporturi auto Thule.",
  },
  {
    email: "contact@urbantools-rent.ro",
    displayName: "Urban Tools & Machinery SRL",
    accountType: "company",
    companyCui: "RO35829104",
    city: "București",
    bio: "Centru autorizat de închiriere scule și utilaje pentru construcții și amenajări rezidențiale. Livrare pe șantier.",
  },
  {
    email: "alexandra.ilie@renta-demo.ro",
    displayName: "Alexandra Ilie",
    accountType: "individual",
    city: "București",
    bio: "Stylist vestimentar. Garderobă extinsă de rochii de seară de gală și smoking-uri de ceremonie.",
  },
  {
    email: "mihai.constantin@renta-demo.ro",
    displayName: "Mihai Constantin",
    accountType: "individual",
    city: "București",
    bio: "Gamer și entuziast tech. Pun la dispoziție console PS5 Pro, căști VR și proiectoare portabile.",
  },
  {
    email: "contact@nordic-camping.ro",
    displayName: "Nordic Outdoor Gear SRL",
    accountType: "company",
    companyCui: "RO44091823",
    city: "București",
    bio: "Echipamente de expediție montană, corturi 4 sezoane, saci puf extrem și accesorii bushcraft.",
  },
  {
    email: "bogdan.serban@renta-demo.ro",
    displayName: "Bogdan Șerban",
    accountType: "individual",
    city: "București",
    bio: "Închiriez echipamente audio pentru petreceri restrânse, boxe portabile JBL și lumini de ambianță.",
  },
  {
    email: "gabriela.manole@renta-demo.ro",
    displayName: "Gabriela Manole",
    accountType: "individual",
    city: "București",
    bio: "Pasionată de camping și călătorii cu autorulota. Închiriez lăzi frigorifice cu compresor și baterii portabile.",
  },
  {
    email: "contact@ecoclean-rent.ro",
    displayName: "EcoClean Industrial SRL",
    accountType: "company",
    companyCui: "RO38491029",
    city: "București",
    bio: "Aparate profesionale de injecție-extracție tapiserii Kärcher, spălătoare pardoseli și dezumidificatoare industriale.",
  },
  {
    email: "marius.enache@renta-demo.ro",
    displayName: "Marius Enache",
    accountType: "individual",
    city: "București",
    bio: "Sportiv amator, dețin caiace gonflabile de tură și plăci SUP pe care le ofer spre închiriere de weekend.",
  },
  {
    email: "contact@partyhub-bucuresti.ro",
    displayName: "PartyHub Concept SRL",
    accountType: "company",
    companyCui: "RO42839102",
    city: "București",
    bio: "Totul pentru petreceri memorabile: mașini de baloane, fântâni de ciocolată, lumini laser și pavilioane impermeabile.",
  },

  // --- CLUJ-NAPOCA (10 utilizatori: 6 Personal + 4 Business) ---
  {
    email: "radu.muresan@renta-demo.ro",
    displayName: "Radu Mureșan",
    accountType: "individual",
    city: "Cluj-Napoca",
    bio: "Inginer software pasionat de munte și astrofotografie. Închiriez trepiede de carbon și obiective wide.",
  },
  {
    email: "contact@transilvania-tools.ro",
    displayName: "Transilvania Tools Hub SRL",
    accountType: "company",
    companyCui: "RO37192849",
    city: "Cluj-Napoca",
    bio: "Centru clujean de închiriere scule profesionale: rotopercutoare grele, mașini de tăiat beton și compresoare.",
  },
  {
    email: "simona.farcas@renta-demo.ro",
    displayName: "Simona Farcaș",
    accountType: "individual",
    city: "Cluj-Napoca",
    bio: "Pasionată de grădinărit și amenajări exterioare. Închiriez motocoase STIHL și tocătoare de crengi.",
  },
  {
    email: "contact@cluj-av-solutions.ro",
    displayName: "Cluj AV & CineRent SRL",
    accountType: "company",
    companyCui: "RO40928192",
    city: "Cluj-Napoca",
    bio: "Furnizor de tehnică AV pentru conferințe și producții video: mixere video Blackmagic, microfoane lavalieră wireless.",
  },
  {
    email: "vlad.pop@renta-demo.ro",
    displayName: "Vlad Pop",
    accountType: "individual",
    city: "Cluj-Napoca",
    bio: "Închiriez echipament de schi freeride, clăpari termoformabili și drone compacte pentru vacanțe.",
  },
  {
    email: "contact@car-and-cargo-cluj.ro",
    displayName: "CargoRent Transilvania SRL",
    accountType: "company",
    companyCui: "RO36491028",
    city: "Cluj-Napoca",
    bio: "Remorci auto basculabile cu prelată 750kg, platforme transport motociclete și cutii portbagaj Thule XXL.",
  },
  {
    email: "ancuta.rusu@renta-demo.ro",
    displayName: "Ancuța Rusu",
    accountType: "individual",
    city: "Cluj-Napoca",
    bio: "Designer de accesorii. Ofer spre închiriere ținute festive și rochii de seară elegante pentru baluri și gale.",
  },
  {
    email: "tudor.groza@renta-demo.ro",
    displayName: "Tudor Groza",
    accountType: "individual",
    city: "Cluj-Napoca",
    bio: "Fotograf de portret. Închiriez lumini de studio Godox cu softbox-uri octogonale și declanșatoare wireless.",
  },
  {
    email: "contact@alpine-rent-cluj.ro",
    displayName: "Alpine Adventure Rental SRL",
    accountType: "company",
    companyCui: "RO43918274",
    city: "Cluj-Napoca",
    bio: "Punct de închiriere echipamente montane Apuseni: corturi de iarnă, kituri de via ferrata, rachete de zăpadă.",
  },
  {
    email: "daniela.boc@renta-demo.ro",
    displayName: "Daniela Boc",
    accountType: "individual",
    city: "Cluj-Napoca",
    bio: "Închiriez stații de călcat cu abur vertical și echipamente de curățenie textilă pentru evenimente.",
  },

  // --- TIMIȘOARA (6 utilizatori: 4 Personal + 2 Business) ---
  {
    email: "sorin.kovacs@renta-demo.ro",
    displayName: "Sorin Kovacs",
    accountType: "individual",
    city: "Timișoara",
    bio: "Pasionat de muzică și DJ amator. Ofer spre închiriere controllere Pioneer DJ și boxe de monitorizare.",
  },
  {
    email: "contact@banat-utilaje.ro",
    displayName: "Banat Utilaje & Unelte SRL",
    accountType: "company",
    companyCui: "RO38291048",
    city: "Timișoara",
    bio: "Închirieri utilaje pentru construcții în județul Timiș: plăci compactoare, elicoptere finisat beton, generatoare.",
  },
  {
    email: "laura.ionesi@renta-demo.ro",
    displayName: "Laura Ionesi",
    accountType: "individual",
    city: "Timișoara",
    bio: "Închiriez echipament de camping de familie: cort 5 persoane, saltele gonflabile duble și aragaz portabil.",
  },
  {
    email: "contact@tim-multimedia.ro",
    displayName: "Tim Multimedia Production SRL",
    accountType: "company",
    companyCui: "RO41829401",
    city: "Timișoara",
    bio: "Echipamente premium foto-video: camere Sony FX3, obiective cinema Sigma Cine, monitoare de control Atomos.",
  },
  {
    email: "adrian.popa@renta-demo.ro",
    displayName: "Adrian Popa",
    accountType: "individual",
    city: "Timișoara",
    bio: "Pasionat de ciclism șosea. Ofer spre închiriere cursiere din carbon și genți rigide de transport pentru avion.",
  },
  {
    email: "camelia.stan@renta-demo.ro",
    displayName: "Camelia Stan",
    accountType: "individual",
    city: "Timișoara",
    bio: "Închiriez aparate foto instant Polaroid/Fujifilm Instax și seturi de recuzită foto pentru nunți.",
  },

  // --- IAȘI (5 utilizatori: 3 Personal + 2 Business) ---
  {
    email: "bogdan.rotaru@renta-demo.ro",
    displayName: "Bogdan Rotaru",
    accountType: "individual",
    city: "Iași",
    bio: "Videograf de eveniment. Închiriez gimbale DJI RS3 Pro, obiective Lumix și microfoane wireless Rode.",
  },
  {
    email: "contact@moldova-scule-rent.ro",
    displayName: "Moldova Tool Rental SRL",
    accountType: "company",
    companyCui: "RO39481023",
    city: "Iași",
    bio: "Parc complet de scule pentru zugrăvit și renovat: pompe airless, mașini de șlefuit pereți cu aspirator.",
  },
  {
    email: "elena.costache@renta-demo.ro",
    displayName: "Elena Costache",
    accountType: "individual",
    city: "Iași",
    bio: "Pasionată de drumeții în Carpații Orientali. Închiriez rucsacuri ergonomice Deuter și bețe telescopice.",
  },
  {
    email: "contact@iasi-sound-stage.ro",
    displayName: "Iași Sound & Stage SRL",
    accountType: "company",
    companyCui: "RO42918402",
    city: "Iași",
    bio: "Soluții profesionale de sonorizare pentru evenimente corporate și festivaluri locale. Boxe active RCF și subwoofere.",
  },
  {
    email: "catalin.marin@renta-demo.ro",
    displayName: "Cătălin Marin",
    accountType: "individual",
    city: "Iași",
    bio: "Închiriez console retro gaming, televizoare portabile și videoproiectoare pentru seri de film în aer liber.",
  },

  // --- BRAȘOV (5 utilizatori: 3 Personal + 2 Business) ---
  {
    email: "cosmin.vlad@renta-demo.ro",
    displayName: "Cosmin Vlad",
    accountType: "individual",
    city: "Brașov",
    bio: "Ghid montan și salvamontist. Închiriez colțari, pioleți tehnici, hamuri și căști de alpinism certificate UIAA.",
  },
  {
    email: "contact@brasov-outdoor-gear.ro",
    displayName: "Brașov Outdoor & Ski SRL",
    accountType: "company",
    companyCui: "RO40192841",
    city: "Brașov",
    bio: "Centru de închiriere schi de tură, splitboard-uri, echipamente de avalanșă (DVA, sondă, lopată) și e-bike-uri MTB.",
  },
  {
    email: "raluca.stanciu@renta-demo.ro",
    displayName: "Raluca Stanciu",
    accountType: "individual",
    city: "Brașov",
    bio: "Închiriez echipamente complete de camping de iarnă și arzatoare multifuel pentru trasee alpine înalte.",
  },
  {
    email: "contact@carpathian-tools.ro",
    displayName: "Carpathian Pro Tools SRL",
    accountType: "company",
    companyCui: "RO37482910",
    city: "Brașov",
    bio: "Închirieri drujbe profesionale STIHL, despicătoare de lemne hidraulice și motoburghie de pământ.",
  },
  {
    email: "mihaela.neagu@renta-demo.ro",
    displayName: "Mihaela Neagu",
    accountType: "individual",
    city: "Brașov",
    bio: "Ofer spre închiriere costume de schi premium Colmar și căști cu vizieră fotocromatică pentru Poiana Brașov.",
  },

  // --- CONSTANȚA (3 utilizatori: 2 Personal + 1 Business) ---
  {
    email: "razvan.marin@renta-demo.ro",
    displayName: "Răzvan Marin",
    accountType: "individual",
    city: "Constanța",
    bio: "Pasionat de sporturi nautice. Închiriez plăci de windsurf, costume de neopren și veste de salvare certificate.",
  },
  {
    email: "contact@blacksea-nautic.ro",
    displayName: "Black Sea Nautic Rental SRL",
    accountType: "company",
    companyCui: "RO41902847",
    city: "Constanța",
    bio: "Ambarcațiuni gonflabile cu motor termic 5CP fără permis, veste de salvare, sonar Garmin și accesorii pescuit maritim.",
  },
  {
    email: "ana.dumitru@renta-demo.ro",
    displayName: "Ana Dumitru",
    accountType: "individual",
    city: "Constanța",
    bio: "Închiriez boxe portabile rezistente la apă, pavilioane de plajă anti-UV și șezlonguri pliabile de aluminiu.",
  },

  // --- SIBIU (3 utilizatori: 2 Personal + 1 Business) ---
  {
    email: "ovidiu.balan@renta-demo.ro",
    displayName: "Ovidiu Bălan",
    accountType: "individual",
    city: "Sibiu",
    bio: "Fotograf de patrimoniu și natură. Închiriez aparate foto mirrorless Canon, obiective macro și stabilizatoare.",
  },
  {
    email: "contact@sibiu-event-rent.ro",
    displayName: "Sibiu Event Gear SRL",
    accountType: "company",
    companyCui: "RO43819204",
    city: "Sibiu",
    bio: "Mese de cocktail, bănci bavareze, ghirlande luminoase de tip Edison și încălzitoare de terasă pe gaz.",
  },
  {
    email: "cristina.morar@renta-demo.ro",
    displayName: "Cristina Morar",
    accountType: "individual",
    city: "Sibiu",
    bio: "Închiriez portbagaje auto de plafon, suporturi de biciclete pentru cârlig și corturi compacte de 2 persoane.",
  },

  // --- ORADEA (2 utilizatori: 1 Personal + 1 Business) ---
  {
    email: "zoltan.nagy@renta-demo.ro",
    displayName: "Zoltán Nagy",
    accountType: "individual",
    city: "Oradea",
    bio: "Pasionat de bricolaj și restaurări auto. Ofer spre închiriere pistoale de vopsit, compresoare și cricuri hidraulice.",
  },
  {
    email: "contact@crisana-rent-tools.ro",
    displayName: "Crișana Rent Tools SRL",
    accountType: "company",
    companyCui: "RO38491038",
    city: "Oradea",
    bio: "Scule electrice de banc, debitatoare de metale, betoniere electrice și aparate de sudură TIG/MIG.",
  },
];

// ============================================================================
// 2. DEFINIȚIE 100 ANUNȚURI FICTIVE REALISTE PE 8 CATEGORII
// ============================================================================
const LISTINGS_DATA = [
  // --------------------------------------------------------------------------
  // CATEGORIA 1: SCULE & UNELTE BRICOLAJ (15 anunțuri)
  // --------------------------------------------------------------------------
  {
    title: "Ciocan Rotopercutor Bosch Professional GBH 2-28 F SDS-Plus",
    category: "scule-unelte",
    pricePerDay: 55,
    pricePerHour: 15,
    depositRon: 250,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Ciocan rotopercutor profesional de 880W cu energie de percuție 3.2 J. Dotat cu mandrină interschimbabilă rapidă (SDS-Plus și mandrină pentru burghie cilindrice). Include set de 3 burghie beton și șpiț.",
    images: [
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Placă Compactoare Reversibilă 90kg Lumag RP-1100PRO",
    category: "scule-unelte",
    pricePerDay: 130,
    pricePerHour: 35,
    depositRon: 500,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Placă vibrantă profesională pe benzină pentru compactarea solului, pietrișului și pavajului. Forță de compactare 15 kN, adâncime de compactare până la 30 cm. Include covor de cauciuc pentru protecția pavelelor.",
    images: [
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Drujbă Profesională STIHL MS 261 C-M pe Benzină",
    category: "scule-unelte",
    pricePerDay: 110,
    pricePerHour: 30,
    depositRon: 400,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Motofierăstrău puternic de 3.0 kW (4.1 CP) cu sistem electronic M-Tronic pentru pornire ușoară și performanță optimă în orice condiții. Lamă de 40 cm, lanț ascuțit recent. Se predă cu cheie de bujie și bidon de amestec.",
    images: [
      "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1590496793929-36417d3117de?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Aparat de Sudură Invertor Lincoln Electric Speedtec 200M Multi-Proces",
    category: "scule-unelte",
    pricePerDay: 140,
    pricePerHour: 40,
    depositRon: 600,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Invertor multi-proces MIG/MAG, TIG și MMA de 200A. Compatibil cu role de sârmă de 5kg, ecran digital intuitiv. Include pistolet MIG, cablu de masă și mască automată heliomată reglabilă.",
    images: [
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Șlefuitor Pereți și Tavane Girafă Festool Planex LHS 2 225 EQ",
    category: "scule-unelte",
    pricePerDay: 160,
    pricePerHour: 45,
    depositRon: 700,
    minRentalDays: 1,
    cancellationPolicy: "strict",
    description:
      "Șlefuitor profesional Festool cu lumină LED circulară integrată pentru detectarea imperfecțiunilor gletului în timp real. Diametru disc 225mm, mișcare excentrică fără zgârieturi. Se conectează direct la aspirator industrial.",
    images: [
      "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Nivelă Laser 3x360° Cu Rază Verde DeWalt DCE089D1G",
    category: "scule-unelte",
    pricePerDay: 65,
    pricePerHour: 20,
    depositRon: 300,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Laser multi-linie autonivelant 3x360 grade cu fascicul verde ultra-vizibil (de 4 ori mai luminos decât cel roșu). Rază de acțiune 30m, precizie +/- 3mm la 10m. Se livrează cu acumulator 12V Li-Ion, încărcător și trepied extensibil.",
    images: [
      "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Generator de Curent Inverter Silențios Honda EU22i (2.2 kW)",
    category: "scule-unelte",
    pricePerDay: 120,
    pricePerHour: 35,
    depositRon: 600,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Generator portabil ultra-silențios (doar 58 dB la 7m) pe tehnologie inverter, furnizând curent sinusoidal pur, ideal pentru electronice sensibile, echipamente audio-video sau rulote. Autonomie până la 8 ore în mod Eco.",
    images: [
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Mașină Profesională de Tăiat Gresie și Faianță Montolit Masterpiuma 93P3",
    category: "scule-unelte",
    pricePerDay: 80,
    pricePerHour: 25,
    depositRon: 350,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Dispozitiv manual de tăiere ceramică de înaltă precizie pentru plăci mari până la 93 cm lungime. Roată tăietoare din carbură de titan, mecanism de rupere cu dublă pârghie pentru plăci de gresie porțelanată groasă.",
    images: [
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Aspirator Industrial pentru Praf Fin Kärcher NT 30/1 Tact Te L",
    category: "scule-unelte",
    pricePerDay: 75,
    pricePerHour: 20,
    depositRon: 300,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Aspirator profesional umed-uscat de 30 litri cu sistem automat de curățare a filtrului prin impulsuri de aer (Tact). Priză sincronizată pentru pornire automată odată cu scula electrică atașată. Furtun antistatic de 4m inclus.",
    images: [
      "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Motoburghiu de Pământ Ruris TT12 pentru Garduri și Puieți",
    category: "scule-unelte",
    pricePerDay: 90,
    pricePerHour: 25,
    depositRon: 350,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Foreză de pământ cu motor termic de 2.3 CP în 2 timpi. Vine cu 3 burghie interschimbabile de 100mm, 150mm și 200mm diametru și prelungitor de 50 cm. Excelent pentru plantat pomi și montat stâlpi de gard.",
    images: [
      "https://images.unsplash.com/photo-1590496793929-36417d3117de?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Pompă Airless Vopsit și Zugrăvit Wagner Control Pro 250 M",
    category: "scule-unelte",
    pricePerDay: 150,
    pricePerHour: 45,
    depositRon: 600,
    minRentalDays: 1,
    cancellationPolicy: "strict",
    description:
      "Sistem airless de vopsire de înaltă eficiență (HEA) care reduce ceața de pulverizare cu până la 55%. Permite aplicarea directă a vopselelor lavabile pe bază de apă sau solvenți. Furtun flexibil de 9m inclus.",
    images: [
      "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Fierăstrău Circular cu Masă DeWalt DWE7485-QS (1850W)",
    category: "scule-unelte",
    pricePerDay: 95,
    pricePerHour: 28,
    depositRon: 450,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Circular de banc portabil cu masă turnată din aluminiu și sistem de ghidare cu pinion și cremalieră pentru precizie milimetrică. Diametru pânză 210mm, adâncime de tăiere 65mm la 90°. Include împingător de siguranță.",
    images: [
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Ciocan Demolator Greu Bosch GSH 11 VC (23 J, SDS-Max)",
    category: "scule-unelte",
    pricePerDay: 140,
    pricePerHour: 40,
    depositRon: 650,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Demolator profesional de 1700W pentru spargerea fundațiilor, plăcilor de beton și pereților din cărămidă. Sistem integrat de amortizare a vibrațiilor Vibration Control. Se predă cu 2 dălți late și un șpiț ascuțit SDS-Max.",
    images: [
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Schelă Mobilă din Aluminiu Kraus ProTec (Înălțime Lucru 5m)",
    category: "scule-unelte",
    pricePerDay: 100,
    pricePerHour: 30,
    depositRon: 500,
    minRentalDays: 2,
    cancellationPolicy: "moderate",
    description:
      "Schelă ușoară din aluminiu cu roți blocabile cu frână și stabilizatori laterali reglabili. Montaj rapid fără unelte speciale, platformă din placaj antiderapant hidrofug cu trapă de acces. Greutate maximă admisă 200 kg.",
    images: [
      "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Mașină de Debitat Metale și Profile Makita LW1400 (2200W)",
    category: "scule-unelte",
    pricePerDay: 70,
    pricePerHour: 20,
    depositRon: 300,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Debitator abraziv staționar cu disc de 355mm. Menghină cu eliberare rapidă și reglare a unghiului de tăiere până la 45 grade. Protecție împotriva scânteilor și mâner ergonomic de transport.",
    images: [
      "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=1200&q=80",
    ],
  },

  // --------------------------------------------------------------------------
  // CATEGORIA 2: FOTO, VIDEO & AUDIO (15 anunțuri)
  // --------------------------------------------------------------------------
  {
    title: "Aparat Foto Sony Alpha A7 IV Body (33 MP, 4K 60p, 10-bit)",
    category: "foto-video",
    pricePerDay: 180,
    pricePerHour: 50,
    depositRon: 1200,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Mirrorless full-frame hibrid de excepție pentru foto și video profesional. Senzor Exmor R 33MP, autofocus cu urmărire ochi în timp real la oameni, animale și păsări. Se predă cu 2 baterii originale NP-FZ100 și card 128GB V90.",
    images: [
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Obiectiv Sony FE 24-70mm f/2.8 GM II G Master",
    category: "foto-video",
    pricePerDay: 140,
    pricePerHour: 40,
    depositRon: 1000,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Cel mai performant și ușor zoom standard f/2.8 full-frame de la Sony. Claritate extremă de la un colț la altul, bokeh cremos, inel de diafragmă declicabil pentru video. Parasolar și filtru UV B+W montat pe lentilă.",
    images: [
      "https://images.unsplash.com/photo-1617005082133-548c4dd27f35?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Stabilizator Gimbal Profesional DJI RS 3 Pro Combo",
    category: "foto-video",
    pricePerDay: 120,
    pricePerHour: 35,
    depositRon: 800,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Gimbal cu brațe din fibră de carbon pentru camere cinema de până la 4.5 kg. Blocare automată a axelor, ecran tactil OLED color de 1.8 inch. Pachetul Combo include motorul de focus DJI LiDAR, transmițător de imagine RavenEye și geantă.",
    images: [
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Dronă DJI Mini 4 Pro Fly More Combo (Sub 249g, 4K 60fps HDR)",
    category: "foto-video",
    pricePerDay: 130,
    pricePerHour: 40,
    depositRon: 900,
    minRentalDays: 1,
    cancellationPolicy: "strict",
    description:
      "Dronă ultra-ușoară care nu necesită permis complex (clasa C0, < 249g). Senzor omnidirecțional de obstacole, filmare verticală nativă pentru social media, telecomandă cu ecran luminos DJI RC 2 și 3 baterii inteligente (până la 90 min zbor).",
    images: [
      "https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Canon EOS R5 Mirrorless 8K RAW (45 Megapixeli, IBIS 8 Stopuri)",
    category: "foto-video",
    pricePerDay: 260,
    pricePerHour: 75,
    depositRon: 1800,
    minRentalDays: 1,
    cancellationPolicy: "strict",
    description:
      "Flagship-ul gamei Canon EOS R: rezoluție excepțională de 45MP, filmare internă 8K 30p RAW și 4K 120p slow-motion. Include adaptor montură EF-EOS R, 2 acumulatori LP-E6NH și card CFexpress Type B de 512GB de mare viteză.",
    images: [
      "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Kit Lumini Continue Studio Aputure Amaran 200x Bi-Color + Softbox",
    category: "foto-video",
    pricePerDay: 90,
    pricePerHour: 25,
    depositRon: 500,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Lumină LED COB de 200W cu temperatură de culoare variabilă de la 2700K la 6500K (CRI/TLCI 95+). Include dom de difuzie circular tip lanternă Aputure Light Dome SE 85cm, stativ pneumatic robust de 2.8m și cablu de alimentare lung.",
    images: [
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Sistem Wireless Microfoane Lavalieră DJI Mic (2 TX + 1 RX)",
    category: "foto-video",
    pricePerDay: 70,
    pricePerHour: 20,
    depositRon: 400,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Sistem audio profesional compact cu înregistrare internă de siguranță pe 32-bit float pe fiecare transmițător. Rază wireless de până la 250m, compatibilitate directă cu iPhone, Android și camere foto prin adaptoare incluse.",
    images: [
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Obiectiv Telefoto Sony FE 70-200mm f/2.8 GM OSS II",
    category: "foto-video",
    pricePerDay: 170,
    pricePerHour: 50,
    depositRon: 1200,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Generația a doua a renumitului teleobiectiv sportiv și de portret, cu 29% mai ușor decât forgul său. Stabilizare optică SteadyShot pe 3 axe, 4 motoare liniare XD pentru autofocus ultra-rapid pe subiecți în mișcare rapidă.",
    images: [
      "https://images.unsplash.com/photo-1617005082133-548c4dd27f35?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Cameră Video Cinema Blackmagic Pocket Cinema Camera 6K Pro",
    category: "foto-video",
    pricePerDay: 210,
    pricePerHour: 60,
    depositRon: 1400,
    minRentalDays: 1,
    cancellationPolicy: "strict",
    description:
      "Cameră cinematografică Super 35 cu filtre ND motorizate integrate (2, 4 și 6 stopuri), ecran HDR rabatabil de 1500 niți și două intrări audio mini-XLR. Include cage complet SmallRig, baterii V-Mount și SSD Samsung T7 1TB.",
    images: [
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Recorder Audio Profesional pe 8 Canale Zoom F8n Pro (32-Bit Float)",
    category: "foto-video",
    pricePerDay: 110,
    pricePerHour: 30,
    depositRon: 650,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Field recorder de teren cu preamplificatoare premium ultra-silențioase (-127 dBu EIN) și înregistrare duală pe 32-bit float (sunetul nu se distorsionează niciodată, indiferent de volum). Include geantă de teren Orca și sursă externă.",
    images: [
      "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Trepied Video din Fibră de Carbon Manfrotto 504X + Picioare Fast Twin",
    category: "foto-video",
    pricePerDay: 85,
    pricePerHour: 25,
    depositRon: 500,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Cap fluid video profesional cu contrabalans variabil pe 4 trepte și bulă de nivel iluminată. Picioare duble din carbon cu sistem de blocare rapidă Fast Lever. Suportă sarcini de până la 12 kg cu mișcări panoramice extrem de line.",
    images: [
      "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Cameră de Acțiune GoPro HERO12 Black Creator Edition",
    category: "foto-video",
    pricePerDay: 75,
    pricePerHour: 20,
    depositRon: 400,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Kit complet pentru vlogging și sporturi extreme: filmare 5.3K 60fps HDR, stabilizare HyperSmooth 6.0, carcasă media Volta cu baterie integrată de 4900mAh, modul de lumină LED și microfon direcțional cu protecție vânt.",
    images: [
      "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Obiectiv Portret Canon RF 85mm f/1.2L USM",
    category: "foto-video",
    pricePerDay: 190,
    pricePerHour: 55,
    depositRon: 1400,
    minRentalDays: 1,
    cancellationPolicy: "strict",
    description:
      "Optica supremă pentru fotografia de portret și eveniment: diafragmă record f/1.2 cu separare tridimensională a subiectului și claritate microscopică chiar la deschidere maximă. Tratament optic Blue Spectrum Refractive (BR).",
    images: [
      "https://images.unsplash.com/photo-1617005082133-548c4dd27f35?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Monitor / Recorder pe Cameră Atomos Ninja V+ 5.2\" 8K HDMI",
    category: "foto-video",
    pricePerDay: 95,
    pricePerHour: 28,
    depositRon: 600,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Monitor de referință cu luminozitate de 1000 niți, perfect vizibil în lumina directă a soarelui. Înregistrare Apple ProRes RAW până la 8K 30p și 4K 120p prin HDMI. Include 2 baterii NP-F970, încărcător și parasolar.",
    images: [
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Aparat Foto Instant Fujifilm Instax Wide 300 + 40 Filme Incluse",
    category: "foto-video",
    pricePerDay: 60,
    pricePerHour: 18,
    depositRon: 250,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Cameră foto analogică instantanee cu format mare de imprimare (format dublu față de Instax Mini). Ideală pentru nuntă, aniversare sau carnet de oaspeți. Pachetul conține 2 pachete a câte 20 de cartușe foto color originale.",
    images: [
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
    ],
  },

  // --------------------------------------------------------------------------
  // CATEGORIA 3: CAMPING & OUTDOOR (13 anunțuri)
  // --------------------------------------------------------------------------
  {
    title: "Cort de Cupolă de Familie The North Face Wawona 6 Persoane",
    category: "camping-outdoor",
    pricePerDay: 85,
    pricePerHour: 25,
    depositRon: 400,
    minRentalDays: 2,
    cancellationPolicy: "flexible",
    description:
      "Cort spațios cu înălțime interioară de 1.95m în care se poate sta în picioare. Vestibul gigantic pentru biciclete sau masă de camping, structură rezistentă la vânturi puternice și cusături termosudate impermeabile.",
    images: [
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Lază Frigorifică Portabilă cu Compresor Dometic CFX3 45L (-22°C la +20°C)",
    category: "camping-outdoor",
    pricePerDay: 75,
    pricePerHour: 22,
    depositRon: 500,
    minRentalDays: 2,
    cancellationPolicy: "moderate",
    description:
      "Frigider și congelator mobil cu compresor VMSO3 de consum redus. Funcționează la 12V brichetă auto sau 230V priză casnică. Ecran digital color și control de pe smartphone prin aplicație Bluetooth/WiFi.",
    images: [
      "https://images.unsplash.com/photo-1517824806704-9040b037703b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Cutie Portbagaj Plafon Thule Motion XT XL (500 Litri, Sistem PowerClick)",
    category: "camping-outdoor",
    pricePerDay: 50,
    pricePerHour: 15,
    depositRon: 400,
    minRentalDays: 3,
    cancellationPolicy: "flexible",
    description:
      "Cutie aerodinamică cu deschidere pe ambele părți (DualSide) și indicator de cuplu sonor pentru strângere sigură pe orice bare transversale. Capacitate de transport 5-7 perechi de schiuri sau bagaje voluminoase până la 75 kg.",
    images: [
      "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Rucsac Montan de Expediție Osprey Aether Pro 70L",
    category: "camping-outdoor",
    pricePerDay: 40,
    pricePerHour: 12,
    depositRon: 250,
    minRentalDays: 2,
    cancellationPolicy: "flexible",
    description:
      "Rucsac tehnic ultra-ușor din material rezistent NanoFly cu sistem de suspensie reglabil AirScape și centură lombară termoformabilă. Husă impermeabilă de ploaie inclusă, multiple puncte de prindere pentru piolet și colțari.",
    images: [
      "https://images.unsplash.com/photo-1622260614153-03223fb72052?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Sac de Dormit din Puf de Gâscă -15°C Marmot Never Summer",
    category: "camping-outdoor",
    pricePerDay: 45,
    pricePerHour: 15,
    depositRon: 300,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Sac de dormit de 4 sezoane umplut cu puf 650 cu tratament hidrofug Down Defender. Temperatură de confort -10°C, limită extremă -28°C. Guler termic căptușit și fermoar secundar pentru ventilare optimă.",
    images: [
      "https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Sistem de Gătit Rapid în Camping Jetboil Flash 1.0L (Fierbere în 100 secunde)",
    category: "camping-outdoor",
    pricePerDay: 25,
    pricePerHour: null,
    depositRon: 150,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Aragaz compact integrat cu cană de titan și flux termic optimizat FluxRing. Fierbe o jumătate de litru de apă în doar 100 secunde. Aprindere piezoelectrică fiabilă și husă neopren cu indicator termocromatic de căldură.",
    images: [
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517824806704-9040b037703b?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Suport Auto pentru 3 Biciclete pe Cârlig Thule VeloCompact 926",
    category: "camping-outdoor",
    pricePerDay: 55,
    pricePerHour: 18,
    depositRon: 450,
    minRentalDays: 2,
    cancellationPolicy: "moderate",
    description:
      "Suport premium rabatabil cu pedală de picior (permite deschiderea portbagajului chiar și cu bicicletele montate). Încuietori cu cheie pentru fiecare bicicletă și pentru prinderea pe cârlig. Priză de iluminat cu 13 pini.",
    images: [
      "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Cort Ușor de Ture Montane 2 Persoane MSR Hubba Hubba NX (1.7 kg)",
    category: "camping-outdoor",
    pricePerDay: 60,
    pricePerHour: 20,
    depositRon: 400,
    minRentalDays: 2,
    cancellationPolicy: "flexible",
    description:
      "Legendarul cort autoportant ultraușor pentru drumeții lungi. Două intrări mari StayDry cu jgheaburi integrate și două vestibule pentru echipament. Folie exterioară impermeabilă DuraShield și plasă fină antimixtură.",
    images: [
      "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Stație de Energie Portabilă EcoFlow River 2 Pro (768Wh, 800W AC)",
    category: "camping-outdoor",
    pricePerDay: 80,
    pricePerHour: 25,
    depositRon: 600,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Generator solar cu baterie LiFePO4 de lungă durată (3000+ cicluri). Se încarcă la priză de la 0 la 100% în doar 70 minute. Ieșiri: 3 prize 230V AC, USB-C 100W și priză auto 12V. Ideal pentru camping autonom sau laptopuri.",
    images: [
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517824806704-9040b037703b?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Saltea Dublă Autogonflabilă Izolată Termic Sea to Summit Comfort Deluxe",
    category: "camping-outdoor",
    pricePerDay: 35,
    pricePerHour: 10,
    depositRon: 200,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Grosime de 10 cm cu spumă Delta Core pentru confort similar unei saltele de acasă. Valoare de izolație R-Value 6.5, permițând dormitul pe sol rece sau zăpadă. Suprafață textilă moale și supapă multifuncțională de umflare rapidă.",
    images: [
      "https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Filtru de Apă Gravitațional Katadyn Base Camp Pro 10L",
    category: "camping-outdoor",
    pricePerDay: 30,
    pricePerHour: 10,
    depositRon: 150,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Sistem cu sac de 10 litri care filtrează apa din izvoare sau râuri prin simpla gravitație (debit 2 litri pe minut). Cartuș din fibră de sticlă cu pori de 0.2 microni care elimină 99.99% din bacterii și protozoare.",
    images: [
      "https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Set Masă Pliabilă cu 4 Scaune din Aluminiu Decathlon Quechua",
    category: "camping-outdoor",
    pricePerDay: 25,
    pricePerHour: null,
    depositRon: 120,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Set compact de camping în care scaunele se pliază complet în interiorul blatului mesei tip valiză cu mâner de transport. Structură stabilă din oțel și aluminiu, blat rezistent la căldură și umezeală.",
    images: [
      "https://images.unsplash.com/photo-1517824806704-9040b037703b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Lanternă Frontală Reîncărcabilă Petzl Nao RL (1500 Lumeni, Reactive Lighting)",
    category: "camping-outdoor",
    pricePerDay: 20,
    pricePerHour: null,
    depositRon: 150,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Frontală ultra-puternică pentru alergare montană nocturnă și speologie. Senzorul integrat adaptează automat intensitatea luminii în funcție de distanța la care privești, prelungind durata bateriei. Acumulator Li-Ion cu indicator.",
    images: [
      "https://images.unsplash.com/photo-1622260614153-03223fb72052?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1200&q=80",
    ],
  },

  // --------------------------------------------------------------------------
  // CATEGORIA 4: EVENIMENTE & PARTY (13 anunțuri)
  // --------------------------------------------------------------------------
  {
    title: "Boxă Activă de Petrecere JBL PartyBox 1000 (1100W, Lumini RGB)",
    category: "evenimente-party",
    pricePerDay: 180,
    pricePerHour: 50,
    depositRon: 1000,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Cea mai puternică boxă de petrecere cu sunet JBL Signature Sound și panou de DJ integrat cu pad-uri de efecte. Efecte luminoase sincronizate cu ritmul muzicii, intrare pentru microfon și chitară și roți de transport rezistente.",
    images: [
      "https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Consolă Standalone DJ Pioneer DJ OPUS-QUAD (4 Canale, Ecran Tactil 10.1\")",
    category: "evenimente-party",
    pricePerDay: 350,
    pricePerHour: 100,
    depositRon: 2500,
    minRentalDays: 1,
    cancellationPolicy: "strict",
    description:
      "Sistem DJ profesional standalone all-in-one de ultimă generație. Redă direct de pe USB/SSD fără laptop, convertoare D/A ESS Technology pe 32-bit de calitate de studio, ieșire pe zone independente și conectivitate Bluetooth.",
    images: [
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Mașină Profesională de Fum Greu pe Bază de Gheață Carbonică 3000W",
    category: "evenimente-party",
    pricePerDay: 160,
    pricePerHour: 45,
    depositRon: 600,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Generator de ceață densă joasă ideal pentru dansul mirilor sau spectacole de scenă. Fumul rămâne pe podea fără să se ridice în încăpere. Include telecomandă DMX fără fir și furtun de dispersie flexibil de 3m.",
    images: [
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Videoproiector Laser Epson EB-L520U (5200 Lumeni, WUXGA / 4K Enhancement)",
    category: "evenimente-party",
    pricePerDay: 200,
    pricePerHour: 60,
    depositRon: 1200,
    minRentalDays: 1,
    cancellationPolicy: "strict",
    description:
      "Proiector laser de mare luminozitate capabil să proiecteze imagini vibrante chiar și în spații iluminate natural. Durată de viață a sursei laser 20.000 ore, deplasare optică a obiectivului (lens shift) și intrări duble HDMI/HDBaseT.",
    images: [
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Ecran Portabil de Proiecție pe Trepied Celexon 244 x 183 cm (Format 4:3 / 16:9)",
    category: "evenimente-party",
    pricePerDay: 50,
    pricePerHour: 15,
    depositRon: 250,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Pânză albă mată de proiecție cu factor de reflexie Gain 1.2 și spate negru opac ce blochează lumina din spate. Trepied metalic stabil cu înălțime reglabilă și carcasă de protecție pentru transport facil.",
    images: [
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Ghirlande Luminoase Retro Edison pentru Grădină (Set 50m, 100 Becuri Calde)",
    category: "evenimente-party",
    pricePerDay: 60,
    pricePerHour: 18,
    depositRon: 250,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Șirag impermeabil de exterior (IP65) cu cablu cauciucat gros și becuri LED tip filament cu lumină galbenă caldă (2200K). Becuri rezistente la șocuri din policarbonat incasabil. Creează o atmosferă magică la nunți în aer liber.",
    images: [
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Pavilion Profesional Pliabil Pop-Up 3x6m Impermeabil cu Pereți Laterali",
    category: "evenimente-party",
    pricePerDay: 130,
    pricePerHour: 40,
    depositRon: 500,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Cort de evenimente cu montare armonică în doar 5 minute. Cadru masiv din aluminiu hexagonal și prelată groasă din poliester 420D cu protecție UV 50+. Include 4 pereți laterali cu ferestre panoramice și saci de nisip pentru lestare.",
    images: [
      "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Pereche Boxe Active Electro-Voice ZLX-15P (2x 1000W) + Statitive și Cabluri",
    category: "evenimente-party",
    pricePerDay: 150,
    pricePerHour: 45,
    depositRon: 800,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Sistem complet de sonorizare format din două incinte active pe 2 căi cu difuzoare de 15 inch și procesor digital DSP QuickSmart cu preseturi pentru muzică, club sau discurs. Pachetul conține 2 stative solide și cabluri XLR de 10m.",
    images: [
      "https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Mașină Profesională de Baloane de Săpun Antari B-200 cu Dublă Turbină",
    category: "evenimente-party",
    pricePerDay: 70,
    pricePerHour: 20,
    depositRon: 300,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Echipament de mare debit cu 4 roți rotative de generare și ventilatoare puternice ce ridică miile de baloane la înălțime mare în aer. Se predă cu 5 litri de lichid special de baloane non-toxic și telecomandă cu fir.",
    images: [
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Kit 4 Proiectoare de Efect Moving Head LED Beam 100W pe Bară T",
    category: "evenimente-party",
    pricePerDay: 170,
    pricePerHour: 50,
    depositRon: 700,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Set complet de lumini dinamice de discotecă cu capete mobile rapide, prismă cu 8 fațete și roată de 14 culori și gobo-uri. Mod automat sincronizat după muzică sau controlabil prin consolă DMX.",
    images: [
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Fântână de Ciocolată Profesională din Inox Sephra 5 Etaje (Înălțime 86cm)",
    category: "evenimente-party",
    pricePerDay: 120,
    pricePerHour: 35,
    depositRon: 500,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Atracția oricărui candy-bar la evenimente festive: capacitate până la 5 kg ciocolată topită, motor ultra-silențios cu antrenare directă fără curele și bază încălzită cu termostat reglabil. Se livrează curățată și igienizată impecabil.",
    images: [
      "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Set 10 Mese Rotunde de Cocktail Pliabile (Înălțime 110cm) cu Fețe Negre",
    category: "evenimente-party",
    pricePerDay: 140,
    pricePerHour: 40,
    depositRon: 500,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Mese înalte tip bar ideale pentru networking sau recepții în picioare. Blat din polietilenă de 80cm rezistent la zgârieturi și picioare rabatabile din oțel. Setul conține și 10 huse mulate elastice negre lavabile.",
    images: [
      "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Încălzitor Terasă Piramidal pe Gaz din Inox cu Flacără Vizibilă (13 kW)",
    category: "evenimente-party",
    pricePerDay: 90,
    pricePerHour: 25,
    depositRon: 350,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Ciupercă radiantă elegantă cu tub de sticlă termorezistentă prin care arde o flacără spectaculoasă. Asigură o rază de încălzire de 5 metri pentru terase și evenimente exterioare de toamnă sau primăvară. Butelie inclusă.",
    images: [
      "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
    ],
  },

  // --------------------------------------------------------------------------
  // CATEGORIA 5: ELECTRONICE & GAMING (13 anunțuri)
  // --------------------------------------------------------------------------
  {
    title: "Consolă Sony PlayStation 5 Pro 2TB + 2 Controllere DualSense Edge",
    category: "electronice",
    pricePerDay: 110,
    pricePerHour: 30,
    depositRon: 900,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Cea mai avansată consolă PlayStation cu tehnologie PlayStation Spectral Super Resolution (PSSR), ray tracing avansat și stocare uriașă de 2TB SSD. Pachetul conține 2 gamepad-uri pro și 4 jocuri de top instalate.",
    images: [
      "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1507457379470-08b800bebc67?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Ochelari de Realitate Virtuală Meta Quest 3 512GB + Elite Strap cu Baterie",
    category: "electronice",
    pricePerDay: 95,
    pricePerHour: 28,
    depositRon: 800,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Casca VR revoluționară de realitate mixtă cu passthrough color de înaltă rezoluție și lentile pancake clare. Vine cu bentița ergonomică Elite Strap cu baterie suplimentară (3.5h autonomie) și controllere Touch Plus.",
    images: [
      "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Laptop Gaming ASUS ROG Zephyrus G16 (Intel Core Ultra 9, RTX 4080, OLED 240Hz)",
    category: "electronice",
    pricePerDay: 180,
    pricePerHour: 55,
    depositRon: 1800,
    minRentalDays: 1,
    cancellationPolicy: "strict",
    description:
      "Stație grafică și laptop de gaming ultra-portabil din carcasă de aluminiu CNC. Ecran ROG Nebula OLED 2.5K la 240Hz, 32GB RAM DDR5, 1TB NVMe. Perfect pentru randări video 3D complexe sau evenimente de e-sports.",
    images: [
      "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Cameră Termoviziune Profesională FLIR E8-XT (-20°C la +550°C, Tehnologie MSX)",
    category: "electronice",
    pricePerDay: 150,
    pricePerHour: 45,
    depositRon: 1200,
    minRentalDays: 1,
    cancellationPolicy: "strict",
    description:
      "Termoviziune cu rezoluție în infraroșu de 320x240 pixeli și tehnologie patentată FLIR MSX care suprapune detaliile vizibile peste imaginea termică. Esențială pentru audit energetic, depistarea punților termice și a infiltrațiilor de apă.",
    images: [
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Consolă Portabilă Steam Deck OLED 1TB cu Ecran HDR 90Hz",
    category: "electronice",
    pricePerDay: 65,
    pricePerHour: 20,
    depositRon: 500,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "PC portabil de gaming de la Valve cu ecran strălucitor OLED HDR, baterie extinsă de 50Wh și stocare rapidă NVMe de 1TB. Se predă cu husă originală căptușită și încărcător rapid USB-C de 45W.",
    images: [
      "https://images.unsplash.com/photo-1507457379470-08b800bebc67?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Videoproiector Portabil Inteligent Anker Nebula Capsule 3 Laser 1080p",
    category: "electronice",
    pricePerDay: 60,
    pricePerHour: 18,
    depositRon: 400,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Proiector de dimensiunea unei doze de suc cu sursă de lumină laser de 300 ANSI lumeni și sistem Google TV integrat cu licență oficială Netflix. Autonomie baterie până la 2.5 ore, difuzor Dolby Audio de 8W.",
    images: [
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Consolă Microsoft Xbox Series X 1TB + Controllere Wireless & Game Pass Ultimate",
    category: "electronice",
    pricePerDay: 85,
    pricePerHour: 25,
    depositRon: 600,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Consolă de generație nouă cu putere de calcul de 12 teraflopi, jocuri în 4K nativ la 60-120 cadre pe secundă și arhitectură Xbox Velocity. Include acces activ la abonamentul Game Pass cu sute de jocuri instalabile.",
    images: [
      "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1507457379470-08b800bebc67?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Volan Gaming Logitech G923 TrueForce cu Pedale și Schimbător Driving Force",
    category: "electronice",
    pricePerDay: 70,
    pricePerHour: 20,
    depositRon: 400,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Sistem de simulare auto cu tehnologie TrueForce de feedback haptic conectat direct la fizica jocului. Rotație la 900 de grade, pedalier cu ambreiaj progresiv și schimbător de viteze H-shifter cu 6 trepte.",
    images: [
      "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Consolă Nintendo Switch OLED Mario Red Edition + 4 Jocuri Multiplayer",
    category: "electronice",
    pricePerDay: 55,
    pricePerHour: 15,
    depositRon: 350,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Ediție de colecție cu ecran OLED de 7 inch și culori vibrante. Pachetul conține dock TV, cablu HDMI, 2 controllere Joy-Con suplimentare (total 4 jucători) și cartușe fizice Mario Kart 8 Deluxe și Super Smash Bros.",
    images: [
      "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1507457379470-08b800bebc67?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Căști Audio Hi-Fi Over-Ear Sony WH-1000XM5 cu Anulare Activă a Zgomotului",
    category: "electronice",
    pricePerDay: 45,
    pricePerHour: 15,
    depositRon: 300,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Căști de călătorie premiate cu liderul în anularea zgomotului de fond (procesor V1 integrat și 8 microfoane). Conexiune multipunct pe două dispozitive simultan, autonomie de 30 de ore și sunet de înaltă rezoluție LDAC.",
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Telecomandă Universală Avansată Logitech Harmony Elite cu Hub Smart",
    category: "electronice",
    pricePerDay: 35,
    pricePerHour: 10,
    depositRon: 200,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Telecomandă inteligentă cu ecran tactil color care poate controla până la 15 dispozitive audio-video și smart home prin Bluetooth, Wi-Fi și infraroșu. Configurare automată a scenariilor (ex: 'Pornire Cinema Seară').",
    images: [
      "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Microfon USB de Studio Shure MV7 Podcast (Ieșire Dublă XLR și USB)",
    category: "electronice",
    pricePerDay: 50,
    pricePerHour: 15,
    depositRon: 300,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Microfon dinamic profesional inspirat din legendarul SM7B, cu panou tactil pentru reglarea nivelului și ieșire pentru căști cu latență zero. Ideal pentru streaming, înregistrări de podcast și interviuri la calitate de radio.",
    images: [
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Kit 2 Walkie-Talkie Motorola Talkabout T82 Extreme (Rază 10 km, IPX4)",
    category: "electronice",
    pricePerDay: 30,
    pricePerHour: 10,
    depositRon: 150,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Stații radio PMR446 robuste fără licență cu ecran ascuns care se aprinde doar la utilizare. Rază de comunicare de până la 10 km în câmp deschis, lanternă LED încorporată, căști cu microfon și geantă dură de transport.",
    images: [
      "https://images.unsplash.com/photo-1507457379470-08b800bebc67?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1200&q=80",
    ],
  },

  // --------------------------------------------------------------------------
  // CATEGORIA 6: VESTIMENTAR & OCAZII (10 anunțuri)
  // --------------------------------------------------------------------------
  {
    title: "Costum Smoking Negru Ceremonie Hugo Boss (Mărime 50/52) din Lână Virgină",
    category: "vestimentar",
    pricePerDay: 130,
    pricePerHour: 40,
    depositRon: 600,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Smoking clasic Black Tie de la renumita casă Hugo Boss, realizat din lână pură cu revere satinate tip șal. Include sacou, pantaloni croiți impecabil cu vipușcă de mătase și papion negru din mătase naturală. Curățat chimic profesional.",
    images: [
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Rochie de Seară de Gală din Mătase și Paillete Pronovias (Mărimea M / 38)",
    category: "vestimentar",
    pricePerDay: 150,
    pricePerHour: 45,
    depositRon: 700,
    minRentalDays: 1,
    cancellationPolicy: "strict",
    description:
      "Rochie lungă spectaculoasă de gală într-o nuanță de albastru regal profund, cu decolteu subtil pe spate și trenă discretă. Confecționată din mătase naturală fluidă cu broderie manuală fină. Se predă în husă protectoare.",
    images: [
      "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Costum Tradițional Autentic Românesc din Maramureș (Complet Bărbați L)",
    category: "vestimentar",
    pricePerDay: 100,
    pricePerHour: 30,
    depositRon: 500,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Piesă autentică de patrimoniu țesută manual la război din pânză groasă de bumbac și in. Cuprinde cămașă cu motive geometrice brodate cu fir negru și roșu, gaci (pantaloni tradiționali largi), chimir lat de piele și clop de paie.",
    images: [
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Costum de Schi și Snowboard Gore-Tex Burton AK 2L Cyclic (Mărimea L)",
    category: "vestimentar",
    pricePerDay: 85,
    pricePerHour: 25,
    depositRon: 450,
    minRentalDays: 2,
    cancellationPolicy: "flexible",
    description:
      "Geacă și pantaloni tehnici impermeabili cu membrană Gore-Tex 2 straturi pentru protecție totală împotriva zăpezii și vântului. Cusături vulcanizate, aerisiri cu fermoare impermeabile și fustă de zăpadă detasabilă.",
    images: [
      "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Rochie Midi Elegantă din Catifea Smarald Elisabetta Franchi (Mărimea S)",
    category: "vestimentar",
    pricePerDay: 110,
    pricePerHour: 30,
    depositRon: 500,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Creație feminină din catifea de mătase elastică cu detalii aurii pe umeri și crăpătură laterală elegantă. Perfectă pentru dineuri festive, premiere de teatru sau cocktail party.",
    images: [
      "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Frac Clasic Ceremonie Regală cu Vesta Pique Albă (Mărimea 48)",
    category: "vestimentar",
    pricePerDay: 140,
    pricePerHour: 40,
    depositRon: 700,
    minRentalDays: 1,
    cancellationPolicy: "strict",
    description:
      "Ținută protocolară White Tie pentru gale diplomatice, baluri vieneze sau concerte simfonice. Include sacou frac din postav fin cu poale prelungite, pantaloni cu dublă vipușcă și vestă albă din bumbac pique.",
    images: [
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Costum de Neopren de Scufundări și Sporturi Nautice O'Neill 5/4mm (Bărbați XL)",
    category: "vestimentar",
    pricePerDay: 50,
    pricePerHour: 15,
    depositRon: 250,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Costum integral călduros din neopren TechnoButter 3 ultra-elastic cu grosime de 5mm pe corp și 4mm pe extremități. Ideal pentru ape reci de primăvară sau toamnă (10-14°C). Include glugă integrată.",
    images: [
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Costum Medieval Cavaler Templier cu Cămașă din Zale Reale (Festivaluri)",
    category: "vestimentar",
    pricePerDay: 90,
    pricePerHour: 25,
    depositRon: 400,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Costumație completă de reconstituire istorică: cămașă autentică din inele de oțel nituite, tunică albă cu cruce roșie templieră, centură din piele groasă și mantie cu glugă. Potrivit pentru spectacole și ședințe foto.",
    images: [
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Geacă Moto Piele Premium Dainese Racing 4 cu Protecții Titaniu (Mărimea 52)",
    category: "vestimentar",
    pricePerDay: 75,
    pricePerHour: 20,
    depositRon: 450,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Geacă din piele de bovină Tutu cu inserții din țesătură bielastică S1. Protecții compozite certificate la coate și umeri, plăci exterioare din aluminiu interschimbabile și buzunar pregătit pentru protecție dorsală G1/G2.",
    images: [
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Rochie Mireasă Boho-Chic din Dantelă Chantilly (Mărimea 36/38)",
    category: "vestimentar",
    pricePerDay: 220,
    pricePerHour: 60,
    depositRon: 1200,
    minRentalDays: 2,
    cancellationPolicy: "strict",
    description:
      "Rochie ușoară de mireasă în stil boem, lucrată fin din dantelă Chantilly și tul de mătase. Mâneci clopot romantice și spate decupat în formă de V. Stare ca nouă, curățată ecologic.",
    images: [
      "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80",
    ],
  },

  // --------------------------------------------------------------------------
  // CATEGORIA 7: SPORT & TIMP LIBER (11 anunțuri)
  // --------------------------------------------------------------------------
  {
    title: "Bicicletă Electrică Mountain Bike CUBE Reaction Hybrid Pro 625 (Motor Bosch CX)",
    category: "sport-timp-liber",
    pricePerDay: 130,
    pricePerHour: 40,
    depositRon: 1000,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "E-bike hardtail cu motor puternic Bosch Performance CX generația 4 (85 Nm) și baterie mare Powertube de 625Wh (autonomie până la 100 km). Furcă pneumatică X-Fusion 120mm, frâne hidraulice Shimano pe 4 pistoane și cască inclusă.",
    images: [
      "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Placă Gonflabilă Stand Up Paddle (SUP) Aqua Marina Beast 3.2m cu Vâslă Carbon",
    category: "sport-timp-liber",
    pricePerDay: 60,
    pricePerHour: 20,
    depositRon: 300,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "SUP all-around stabil și manevrabil pe lacuri sau mare caldă. Include rucsac de transport, pompă de înaltă presiune cu dublă acțiune, lesă de picior (leash) de siguranță, aripioară centrală și vestă de salvare omologată.",
    images: [
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Caiac Gonflabil de Tură 2 Persoane Sevylor Alameda (Include 2 Padele)",
    category: "sport-timp-liber",
    pricePerDay: 80,
    pricePerHour: 25,
    depositRon: 400,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Caiac stabil cu fund rigid din PVCRanforsat și scaune ergonomice Sevy-Spension suspendate pentru confort la vâslit îndelungat. Capacitate maximă 210 kg, prevăzut cu manometru de presiune și două padele din aluminiu.",
    images: [
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Set Schiuri All-Mountain Atomic Vantage 79 TI + Legături + Bețe (171 cm)",
    category: "sport-timp-liber",
    pricePerDay: 70,
    pricePerHour: 20,
    depositRon: 350,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Schiuri polivalente cu miez din lemn de frasin ranforsat cu plasă de titan pentru aderență excelentă pe pârtii înghețate și viraje controlate. Canturile au fost ascuțite recent, iar talpa ceruită profesional.",
    images: [
      "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Snowboard Burton Custom Flying V 158cm cu Legături Burton Cartel",
    category: "sport-timp-liber",
    pricePerDay: 75,
    pricePerHour: 22,
    depositRon: 400,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Placă legendară all-mountain cu profil hibrid rocker/camber Flying V pentru flotabilitate în zăpadă mare și manevrabilitate jucăușă pe pârtie. Legături responsive Cartel cu perne de amortizare FullBED.",
    images: [
      "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Trotinetă Electrică Urbană Segway Ninebot Max G2 (Rază 70 km, Suspensie Dublă)",
    category: "sport-timp-liber",
    pricePerDay: 65,
    pricePerHour: 20,
    depositRon: 450,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Cea mai fiabilă trotinetă electrică de navetă: anvelope tubeless de 10 inch cu strat de auto-sigilare împotriva penelor, suspensie hidraulică față și dublă pe arcuri spate, semnalizatoare integrate și frână regenerativă.",
    images: [
      "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Set Crose de Golf Callaway Warbird (14 Piese) cu Geantă Stand Bag",
    category: "sport-timp-liber",
    pricePerDay: 110,
    pricePerHour: 30,
    depositRon: 600,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Set complet de dreapta pentru începători și nivel mediu: Driver de 10.5 grade, lemn de fairway 3, hibrid 4, fiare de la 5 la Sand Wedge și Putter clasic Odyssey. Include geantă ușoară de umăr cu picioare retractabile.",
    images: [
      "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Set 2 Rachete Tenis Babolat Pure Drive 300g (Mărime Grip L3) + Mingi",
    category: "sport-timp-liber",
    pricePerDay: 40,
    pricePerHour: 12,
    depositRon: 200,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Rachete iconice cu putere explozivă și stabilitate la impact grație sistemului HTR și tehnologiei SWX Pure Feel. Racordate recent cu racordaj monofilament Babolat RPM Blast la 24 kg. Tub de 4 mingi noi inclus.",
    images: [
      "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Skateboard Electric Meepo Shuffle V4 (Viteză Max 45 km/h, Autonomie 20 km)",
    category: "sport-timp-liber",
    pricePerDay: 55,
    pricePerHour: 15,
    depositRon: 350,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "E-longboard cu două motoare în butuc de câte 540W și punte flexibilă din arțar canadian cu fibră de sticlă. Telecomandă M4S cu ecran digital ce afișează viteza și nivelul bateriei în timp real. Se predă cu cască și genunchiere.",
    images: [
      "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Cursieră Șosea din Carbon Specialized Tarmac SL6 (Mărimea 56 / L)",
    category: "sport-timp-liber",
    pricePerDay: 120,
    pricePerHour: 35,
    depositRon: 900,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Bicicletă de șosea de competiție cu cadru și furcă din carbon FACT 9r. Echipare completă Shimano 105 R7000 pe 11 viteze, roți aerodinamice DT Swiss și anvelope Continental Grand Prix 5000 pentru viteză maximă pe asfalt.",
    images: [
      "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Kit Complet Escaladă & Alpinism Petzl (Ham Corax + Cască Sirocco + Asigurare Grigri)",
    category: "sport-timp-liber",
    pricePerDay: 45,
    pricePerHour: 15,
    depositRon: 250,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Pachet de siguranță verificat periodic: ham ajustabil Petzl Corax mărimea 2, cască ultra-ușoară Sirocco din EPP, dispozitiv de rapel și filare cu blocare asistată Grigri+ și 2 carabiere cu siguranță cu șurub.",
    images: [
      "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
    ],
  },

  // --------------------------------------------------------------------------
  // CATEGORIA 8: ALTE ECHIPAMENTE (10 anunțuri)
  // --------------------------------------------------------------------------
  {
    title: "Aparat de Spălat cu Presiune Kärcher K 7 Premium Smart Control (180 Bar, 600 l/h)",
    category: "altele",
    pricePerDay: 85,
    pricePerHour: 25,
    depositRon: 400,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Vârful de gamă Kärcher pentru curățenie exterioară profundă. Pistol Smart Control cu ecran LCD și mod Boost suplimentar. Include lance multijet 3-în-1, curățitor de terase T-Racer 7 și tambur de furtun integrat de 10m.",
    images: [
      "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Aparat Profesional Curățare Covoare și Tapițerii Kärcher Puzzi 10/1",
    category: "altele",
    pricePerDay: 90,
    pricePerHour: 25,
    depositRon: 450,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Echipament cu sistem de pulverizare-extracție pentru curățarea în profunzime a canapelelor, scaunelor auto și carpetelor. Lasă o umiditate reziduală minimă, textilele uscându-se rapid. Se predă cu 4 pastile detergent profesional.",
    images: [
      "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Dezumidificator Profesional de Șantier Trotec TTK 170 ECO (52L / 24h)",
    category: "altele",
    pricePerDay: 75,
    pricePerHour: 20,
    depositRon: 400,
    minRentalDays: 2,
    cancellationPolicy: "moderate",
    description:
      "Dezumidificator industrial rezistent cu carcasă din oțel pentru uscarea rapidă a șapelor proaspăt turnate, a tencuielilor sau după inundații. Dezghețare automată cu gaz cald și contor orar de funcționare.",
    images: [
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Remorcă Auto 750kg cu Prelată Înaltă Repo (Dimensiuni 205 x 125 x 140 cm)",
    category: "altele",
    pricePerDay: 70,
    pricePerHour: 20,
    depositRon: 350,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Remorcă ușoară monoax care se conduce cu permis categoria B. Prelată impermeabilă cu deschidere pe ambele capete, obloane rabatabile din tablă zincată și roată de manevră frontală. Se predă cu roată de rezervă și antifurt pe cuplă.",
    images: [
      "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Detector de Metale Profesional Garrett ACE 400i cu Bobină Submersibilă DD",
    category: "altele",
    pricePerDay: 65,
    pricePerHour: 18,
    depositRon: 350,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Detector performant pentru căutare comori, monede și bijuterii pierdute. Frecvență de operare 10 kHz, identificare digitală a țintei pe scală de la 0 la 99 și localizare exactă prin funcția Pinpoint. Include căști cu fir Garrett.",
    images: [
      "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Telescop Astronomic Dobson Sky-Watcher 200/1200 (Diametru Oglindă 8 Inch)",
    category: "altele",
    pricePerDay: 80,
    pricePerHour: 25,
    depositRon: 500,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Telescop newtonian de mare deschidere montat pe montură altazimutală intuitivă tip Dobson. Oferă priveliști spectaculoase ale craterelor lunare, inelelor lui Saturn, sateliților lui Jupiter și nebuloaselor din cerul profund. Include 2 oculare Plossl.",
    images: [
      "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Chitară Acustică Premium Taylor 214ce Plus cu Husă Semirigidă Aerocase",
    category: "altele",
    pricePerDay: 85,
    pricePerHour: 25,
    depositRon: 600,
    minRentalDays: 1,
    cancellationPolicy: "moderate",
    description:
      "Instrument muzical de înaltă clasă cu corp Grand Auditorium și decupaj venetian. Față din molid Sitka masiv, spate din palisandru laminat și electronică activă Expression System 2 cu sunet acustic natural la amplificare.",
    images: [
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Aparat de Sudat Țevi PPR și Polipropilenă Dytron Polys P-4a 650W",
    category: "altele",
    pricePerDay: 40,
    pricePerHour: 12,
    depositRon: 200,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Bac profesional de lipit țevi sanitare din polipropilenă cu reglare electronică a temperaturii cu microprocesor. Set complet de bacuri teflonate de 20, 25, 32 și 40 mm, foarfecă tăiat țevi și cutie metalică de transport.",
    images: [
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Mașină Profesională de Curățat cu Abur Uscat Polti Vaporetto Pro 95_Turbo Flexi",
    category: "altele",
    pricePerDay: 65,
    pricePerHour: 20,
    depositRon: 300,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Generator de abur igienizant la presiune de 5 bari care elimină 99.99% din viruși, bacterii și acarieni fără detergenți chimici. Autonomie nelimitată cu rezervor cu reumplere continuă și talpă mare de curățare pardoseli.",
    images: [
      "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=1200&q=80",
    ],
  },
  {
    title: "Trusă Mecanică Chei Tubulare și Clichet 216 Piese Mannesmann M98430",
    category: "altele",
    pricePerDay: 35,
    pricePerHour: 10,
    depositRon: 200,
    minRentalDays: 1,
    cancellationPolicy: "flexible",
    description:
      "Valiză rezistentă din oțel Crom-Vanadiu cu 3 clichete fine cu 72 dinți (1/4\", 3/8\" și 1/2\"), game complete de tubulare scurte și lungi, biți Torx, Inbus și chei combinate. Tot ce ai nevoie pentru reparații auto sau utilaje.",
    images: [
      "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=80",
    ],
  },
];

// ============================================================================
// 3. EXECUȚIE POPULARE & SINCRONIZARE BAZĂ DE DATE
// ============================================================================
async function main() {
  console.log("============================================================");
  console.log("🚀 RentA — Începe Popularea cu 50 Utilizatori & 100 Anunțuri");
  console.log("============================================================");

  const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Pasul 1: Înregistrare / Conectare 50 Utilizatori
  console.log(`\n📋 Pasul 1: Inițializare 50 Utilizatori Virtuali...`);
  const activeUsers = [];

  for (let i = 0; i < USERS_DATA.length; i++) {
    const u = USERS_DATA[i];
    process.stdout.write(
      `[${i + 1}/${USERS_DATA.length}] ${u.displayName} (${u.accountType}, ${u.city})... `
    );

    let userId = null;
    let userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Încercăm sign-up
    const { data: signUpData, error: signUpErr } =
      await userClient.auth.signUp({
        email: u.email,
        password: DEMO_PASSWORD,
        options: {
          data: {
            display_name: u.displayName,
            account_type: u.accountType,
            city: u.city,
            company_cui: u.companyCui || null,
          },
        },
      });

    if (signUpData?.user?.id) {
      userId = signUpData.user.id;
      process.stdout.write(` Înregistrat ✓\n`);
    } else if (
      signUpErr &&
      (signUpErr.message.toLowerCase().includes("already registered") ||
        signUpErr.status === 400)
    ) {
      // Dacă utilizatorul există deja, ne autentificăm
      const { data: signInData, error: signInErr } =
        await userClient.auth.signInWithPassword({
          email: u.email,
          password: DEMO_PASSWORD,
        });

      if (signInData?.user?.id) {
        userId = signInData.user.id;
        process.stdout.write(` Autentificat (existent) ✓\n`);
      } else {
        process.stdout.write(` Eroare autentificare: ${signInErr?.message} ✗\n`);
      }
    } else {
      process.stdout.write(` Eroare signup: ${signUpErr?.message} ✗\n`);
    }

    if (userId) {
      // Actualizăm bio-ul pe profil dacă lipsește
      await userClient
        .from("profiles")
        .update({ bio: u.bio })
        .eq("id", userId);

      activeUsers.push({
        id: userId,
        email: u.email,
        displayName: u.displayName,
        city: u.city,
        accountType: u.accountType,
        client: userClient,
      });
    }

    // Pauză mică pentru a preveni rate-limiting pe auth
    await sleep(200);
  }

  console.log(`\n🎉 Utilizatori activi disponibili: ${activeUsers.length} din 50`);
  if (activeUsers.length === 0) {
    console.error("❌ Niciun utilizator nu a putut fi inițializat. Oprim execuția.");
    process.exit(1);
  }

  // Pasul 2: Populare 100 de Anunțuri Distribuite către Utilizatori
  console.log(
    `\n📦 Pasul 2: Creare 100 de Anunțuri Fictive și Galeriile Foto...`
  );

  let createdListingsCount = 0;
  let skippedListingsCount = 0;

  for (let i = 0; i < LISTINGS_DATA.length; i++) {
    const item = LISTINGS_DATA[i];
    // Asignăm anunțul ciclic utilizatorilor disponibili
    const owner = activeUsers[i % activeUsers.length];

    process.stdout.write(
      `[${i + 1}/${LISTINGS_DATA.length}] ${item.title.substring(0, 45)}... `
    );

    // Verificăm dacă anunțul există deja pentru a menține scriptul idempotent
    const { data: existing } = await owner.client
      .from("listings")
      .select("id, catalog_code")
      .eq("owner_id", owner.id)
      .eq("title", item.title)
      .maybeSingle();

    if (existing) {
      process.stdout.write(` Deja există (${existing.catalog_code}) ⏭️\n`);
      skippedListingsCount++;
      continue;
    }

    // Inserăm anunțul
    const { data: newListing, error: listErr } = await owner.client
      .from("listings")
      .insert({
        owner_id: owner.id,
        title: item.title,
        description: item.description,
        category: item.category,
        price_per_day: item.pricePerDay,
        price_per_hour: item.pricePerHour,
        city: owner.city,
        deposit_ron: item.depositRon,
        min_rental_days: item.minRentalDays,
        cancellation_policy: item.cancellationPolicy,
        status: "available",
      })
      .select("id, catalog_code")
      .single();

    if (listErr) {
      process.stdout.write(` Eroare inserare: ${listErr.message} ✗\n`);
      continue;
    }

    // Inserăm imaginile aferente în public.listing_images
    if (newListing && item.images && item.images.length > 0) {
      const imageRows = item.images.map((imgUrl, idx) => ({
        listing_id: newListing.id,
        storage_path: `seed/${item.category}/${idx}.jpg`,
        url: imgUrl,
        display_order: idx,
      }));

      const { error: imgErr } = await owner.client
        .from("listing_images")
        .insert(imageRows);

      if (imgErr) {
        process.stdout.write(
          ` Salvat [${newListing.catalog_code}], dar eroare imagini: ${imgErr.message}\n`
        );
      } else {
        process.stdout.write(
          ` Creat [${newListing.catalog_code}] (${item.images.length} foto) ✓\n`
        );
      }
    } else {
      process.stdout.write(` Creat [${newListing.catalog_code}] ✓\n`);
    }

    createdListingsCount++;
    await sleep(150); // Pauză scurtă
  }

  // Pasul 3: Raport și Statistici Finale
  console.log("\n============================================================");
  console.log("📊 RAPORT FINAL GENERARE DATE VIRTUALE");
  console.log("============================================================");
  console.log(`• Utilizatori pregătiți: ${activeUsers.length}`);
  console.log(`• Anunțuri noi create: ${createdListingsCount}`);
  console.log(`• Anunțuri deja existente: ${skippedListingsCount}`);

  // Interogăm baza de date pentru metricile globale reale
  const { count: totalProfiles } = await adminClient
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { count: totalListings } = await adminClient
    .from("listings")
    .select("*", { count: "exact", head: true });

  const { count: totalImages } = await adminClient
    .from("listing_images")
    .select("*", { count: "exact", head: true });

  console.log(`\nStare Curentă în Supabase:`);
  console.log(`  - Total Profiluri Utilizatori: ${totalProfiles}`);
  console.log(`  - Total Anunțuri Active în Catalog: ${totalListings}`);
  console.log(`  - Total Imagini în Galerie: ${totalImages}`);
  console.log("============================================================\n");
}

main().catch(console.error);
