/**
 * ArtivicoLab — Data
 * Real-world static applications + reusable website templates
 */

const MSHOTS = (url) => `https://s.wp.com/mshots/v1/${encodeURIComponent(url)}?w=1200&h=900`;

const SHOWCASE_WEBSITES = [
    // ───────────────────────── Applications ─────────────────────────
    {
        "id": 101,
        "category": "application",
        "title": "AdCalc",
        "description": "Free, private ad profit & unit-economics calculator for DTC and dropshipping store owners.",
        "url": "https://adcalc.artivicolab.com/",
        "thumbnail": MSHOTS("https://adcalc.artivicolab.com/"),
        "metadata": {
            "created": "2025",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Marketing analytics tool"
        }
    },
    {
        "id": 102,
        "category": "application",
        "title": "Btwinus",
        "description": "Real-world static application by ArtivicoLab.",
        "url": "https://btwinus.com/",
        "thumbnail": MSHOTS("https://btwinus.com/"),
        "metadata": {
            "created": "2025",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Web application"
        }
    },
    {
        "id": 103,
        "category": "application",
        "title": "Foolscap",
        "description": "Generate, fill, and live-sign contracts in your browser — verified PDF with signing certificate.",
        "url": "https://foolscap.artivicolab.com/",
        "thumbnail": MSHOTS("https://foolscap.artivicolab.com/"),
        "metadata": {
            "created": "2025",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Contracts & e-signing"
        }
    },
    {
        "id": 104,
        "category": "application",
        "title": "Hookline",
        "description": "Script short-form video in blocks, timed to your speaking pace.",
        "url": "https://hookline.artivicolab.com/",
        "thumbnail": MSHOTS("https://hookline.artivicolab.com/"),
        "metadata": {
            "created": "2025",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Content creation"
        }
    },
    {
        "id": 105,
        "category": "application",
        "title": "Pressdown",
        "description": "Write Markdown, see the real email render live, copy the HTML and send anywhere.",
        "url": "https://pressdown.artivicolab.com/",
        "thumbnail": MSHOTS("https://pressdown.artivicolab.com/"),
        "metadata": {
            "created": "2025",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Email & newsletters"
        }
    },
    {
        "id": 106,
        "category": "application",
        "title": "InvoiceMaster",
        "description": "Private, free invoice generator — 12 templates, no signup required.",
        "url": "https://invoicemaster.artivicolab.com/",
        "thumbnail": MSHOTS("https://invoicemaster.artivicolab.com/"),
        "metadata": {
            "created": "2025",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Business tool"
        }
    },
    {
        "id": 107,
        "category": "application",
        "title": "QuizBuffet",
        "description": "Real-world static application by ArtivicoLab.",
        "url": "https://quizbuffet.com/",
        "thumbnail": MSHOTS("https://quizbuffet.com/"),
        "metadata": {
            "created": "2025",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Web application"
        }
    },
    {
        "id": 115,
        "category": "application",
        "title": "Number Lab",
        "description": "Georgia Lottery number generator (Mega Millions) with 15 model predictions.",
        "url": "https://lottery.artivicolab.com/",
        "thumbnail": MSHOTS("https://lottery.artivicolab.com/"),
        "metadata": {
            "created": "2026",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Lottery number generator"
        }
    },
    {
        "id": 114,
        "category": "application",
        "title": "GA Pawns",
        "description": "Compare licensed Georgia pawn shops, title pawns, and gold buyers by rating, reviews, and specialty.",
        "url": "https://pawns.artivicolab.com/",
        "thumbnail": MSHOTS("https://pawns.artivicolab.com/"),
        "metadata": {
            "created": "2026",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Marketplace directory"
        }
    },
    {
        "id": 113,
        "category": "application",
        "title": "GA Lawyers",
        "description": "Browse 5,178 law firms and attorneys across Georgia by city, county, ZIP, or practice area.",
        "url": "https://lawyers.artivicolab.com/",
        "thumbnail": MSHOTS("https://lawyers.artivicolab.com/"),
        "metadata": {
            "created": "2026",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Legal services directory"
        }
    },
    {
        "id": 112,
        "category": "application",
        "title": "GA Contractors",
        "description": "Find licensed Georgia builders by trade, city, county, or ZIP.",
        "url": "https://gac.artivicolab.com/",
        "thumbnail": MSHOTS("https://gac.artivicolab.com/"),
        "metadata": {
            "created": "2026",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Business directory"
        }
    },
    {
        "id": 111,
        "category": "application",
        "title": "GA Spas",
        "description": "Georgia's spa & wellness directory — discover vetted day spas, med spas, and massage studios.",
        "url": "https://ga.spas.artivicolab.com/",
        "thumbnail": MSHOTS("https://ga.spas.artivicolab.com/"),
        "metadata": {
            "created": "2026",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Spa & wellness directory"
        }
    },
    {
        "id": 110,
        "category": "application",
        "title": "Lingala",
        "description": "A daily phrase from home for Congolese everywhere, wrapped in a beautifully designed culture card.",
        "url": "https://lingala.artivicolab.com/",
        "thumbnail": MSHOTS("https://lingala.artivicolab.com/"),
        "metadata": {
            "created": "2026",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Language & cultural identity"
        }
    },
    {
        "id": 109,
        "category": "application",
        "title": "PricePrint",
        "description": "Your personal grocery price memory — detect fake sales, shrinkflation, and track personal inflation.",
        "url": "https://priceprint.artivicolab.com/",
        "thumbnail": MSHOTS("https://priceprint.artivicolab.com/"),
        "metadata": {
            "created": "2026",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Price tracking & shopping analytics"
        }
    },
    {
        "id": 108,
        "category": "application",
        "title": "ProxForm",
        "description": "GDPR-proof medical intake forms — 100% browser-only, peer-to-peer, no server.",
        "url": "https://proxform.artivicolab.com/",
        "thumbnail": MSHOTS("https://proxform.artivicolab.com/"),
        "metadata": {
            "created": "2025",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Healthcare forms"
        }
    },

    // ───────────────────────── Templates ─────────────────────────
    {
        "id": 1,
        "category": "template",
        "title": "Island Vibes Kitchen",
        "description": "Complete Restaurant Website Template with Jamaican/Caribbean Theme",
        "url": "https://gradikay.github.io/IslandVibesKitchen/",
        "thumbnail": "assets/images/IslandVibesKitchen-thumbnail.png",
        "metadata": {
            "created": "May 10, 2025",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Jamaican Restaurant"
        }
    },
    {
        "id": 2,
        "category": "template",
        "title": "Nail Nova",
        "description": "Complete Nail Salon Website Template with orange and pink Theme",
        "url": "https://gradikay.github.io/NailNova/",
        "thumbnail": "assets/images/nailnova.webp",
        "metadata": {
            "created": "May 19, 2025",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Nail Salon"
        }
    },
    {
        "id": 3,
        "category": "template",
        "title": "Island Flavors",
        "description": "Complete Restaurant Website Template with Jamaican/Caribbean Theme",
        "url": "https://gradikay.github.io/JamaicanCuisine/",
        "thumbnail": "assets/images/IslandFlavors-JamaicanCuisine.webp",
        "metadata": {
            "created": "May 10, 2025",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Jamaican Restaurant"
        }
    },
    {
        "id": 4,
        "category": "template",
        "title": "Sparkle Nails",
        "description": "Complete Nail Salon Website Template with red and pink Theme",
        "url": "https://gradikay.github.io/SparkleNails/",
        "thumbnail": "assets/images/sparklenailshome.webp",
        "metadata": {
            "created": "May 19, 2025",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Nail Salon"
        }
    },
    {
        "id": 5,
        "category": "template",
        "title": "Elegant Hair Studio",
        "description": "Complete Hair Salon Landing Page Template with Yellow and Orange Theme",
        "url": "https://gradikay.github.io/ElegantHairStudio/",
        "thumbnail": "assets/images/ElegantHairStudio.webp",
        "metadata": {
            "created": "May 21, 2025",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Hair Salon"
        }
    },
    {
        "id": 6,
        "category": "template",
        "title": "Neon Fluencer",
        "description": "Complete Influencer Landing Page Template with Black Theme",
        "url": "https://gradikay.github.io/NeonFluencer/",
        "thumbnail": "assets/images/neonfluencer.webp",
        "metadata": {
            "created": "May 21, 2025",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Influencer"
        }
    },
    {
        "id": 7,
        "category": "template",
        "title": "Luxe Hair Studio",
        "description": "Premium Hair Salon Website Template with Luxury Theme",
        "url": "https://luxehairstudio.artivicolab.com/",
        "thumbnail": "assets/images/luxehairstudio.png",
        "metadata": {
            "created": "July 19, 2025",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Hair Salon"
        }
    },
    {
        "id": 8,
        "category": "template",
        "title": "Luxe Styles by Jasmine",
        "description": "Professional Hair Styling Website with Pink Theme",
        "url": "https://luxestylesbyjasmine.artivicolab.com/",
        "thumbnail": "assets/images/luxestylesbyjasmine.png",
        "metadata": {
            "created": "July 20, 2025",
            "technologies": ["HTML", "CSS", "JavaScript"],
            "organization": "ArtivicoLab",
            "type": "Hair Salon"
        }
    }
];
