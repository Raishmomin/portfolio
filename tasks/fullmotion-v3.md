# Round 3: AI, Services, FAQ, Contact scenes (owner feedback 2026-11-07)

The owner sent a screenshot of the AI section: /home/raish/raish/.my-app-lanes/data/fm3/owner-ai-section.png. They asked for four things:

1. **AI.** "Change this animation." The pipeline is a thin line of small nodes in a narrow strip, surrounded by a lot of empty space, and it looks the same for every project.
2. **Contact.** "The animation does not look proper. Update it." The scene is mostly hidden behind the wide contact panel and form, the converging node is barely visible, and it isn't tied to the content.
3. **Services.** "Add animation." Today the section only has the ambient field.
4. **FAQ.** "Add animation." Today the section only has the ambient field.

## Contract (committed by the lead before the lanes start)

- **Scene keys:** `SceneKey` now includes `services` and `faq`. Scroll order: hero, stack, experience, ai, work, services, faq, contact, ambient.
  - `data-section="services"` and `data-section="faq"` resolve to their own scenes. Other pages pick a scene with `data-scene`.
  - Placeholder scenes live in components/neural/scenes/{services,faq}.tsx and are already registered in stage.tsx.
- **Data:**
  - `NeuralData.services` comes from app/lib/services.ts: slug, title, tagline, tech, deliverables.
  - `NeuralData.facts` comes from profile.ts: years, location, city, utcOffsetMin, availability, channels.
- **Home sections are one file each:** components/home/{services,writing,faq,contact}.tsx. There is no more components/home/more.tsx.
- **Focus ids:** service cards use `service:<slug>`, FAQ items use `faq:<topic>:<slug>`, and AI items keep the project slug as today. A lane may add more focus ids if it prefixes them with its own name.

## Lanes (strict ownership; each in /home/raish/raish/.my-app-lanes/fm3-<lane>)

| Lane | Port | Owns |
|---|---|---|
| ai | 3931 | components/neural/scenes/ai.tsx, scenes/ai/**, components/home/ai.tsx, components/pages/projects/ai-pipelines.tsx, globals block `/* fm3-ai */` |
| contact | 3932 | components/neural/scenes/contact.tsx, scenes/contact/**, components/home/contact.tsx, app/contact/page.tsx, components/pages/contact/**, components/contact-form.tsx, components/copy-email.tsx, globals block `/* fm3-contact */` |
| services | 3933 | components/neural/scenes/services.tsx, scenes/services/**, components/home/services.tsx, app/services/page.tsx, app/services/[slug]/page.tsx, components/pages/services/**, components/service-page.tsx, globals block `/* fm3-services */` |
| writing (added 2026-11-08 after the whole-site review: Writing was the only dead home section) | 3935 | components/neural/scenes/writing.tsx, scenes/writing/**, components/home/writing.tsx, components/home/latest-posts.tsx, globals block `/* fm3-writing */`. Focus ids `post:<slug>`; the scene reads post titles/dates from the server-rendered cards (labels duplicate DOM text). |
| faq | 3934 | components/neural/scenes/faq.tsx, scenes/faq/**, components/home/faq.tsx, components/pages/about/faq-list.tsx, the item markup of every other FAQ list (it may create a shared components/ui/faq-list.tsx), globals block `/* fm3-faq */` |

- **Service pages:** the services lane owns components/service-page.tsx, but only the faq lane changes the markup of the FAQ items in it.
- **Shared, read-only for every lane:** stage.tsx, director.ts, framing.ts, occluders.ts, labels.ts, types.ts, neural-data.ts and components/motion/**. If a lane needs a change in one of these, it reports it and the lead applies it.
