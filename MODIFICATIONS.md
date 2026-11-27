# What was changed / Не өзгертілді

This is a **modified version** of the BioGlow Robot Game Simulator. Modified on **2026-11-27**. The whole work stays under **AGPL-3.0** (see [LICENSE](LICENSE)).

- Base version: <https://github.com/andrewjgcoward-dot/fll-bioglow-simulator> (commit `7557329`)
- Original project: <https://github.com/masterpigg/fll-bioglow-simulator>

## Қосылғаны

- **Тілдер:** қазақша (бастапқы), орысша, ағылшынша интерфейс және блоктар (`src/i18n.js`, `src/lang/`).
- **EV3 роботының 3D моделі:** фотоларға қарап жасалды (`src/robot-ev3.js`, `src/robot-viewer.js`), `.obj` файлына жүктеледі.
- **Миссия физикасы (жеңілдетілген):** итеру күші, миссияға қойылатын бағыт, ең аз күш және ең үлкен жылдамдық шегі, айыр тетігінің бос бөлшекті массасына қарай көтеруі (`src/physics.js`, `src/sim.js`).
- **Интерфейс:** иконкалар, 2D карта / 3D алаң / 3D робот ауыстырғышы, қосымша панельдер жиналып тұрады, телефонға бейімделген.
- **Өз картаңыздың фотосы:** тек ашық тұрған бетте қолданылады, еш жерге жіберілмейді.
- **Интернетсіз редактор:** Blockly 11.2.2 жоба ішіне салынды; сырттан CDN не шрифт жүктелмейді.

## Алынып тасталғаны

| Не | Неге |
| --- | --- |
| `assets/field-models/` (3D миссия модельдері) | Ондағы жазба бойынша таратуға жаңа лицензия берілмейді. 3D алаң қарапайым блоктар көрсетеді. |
| `assets/mat.jpg` | Карта суреті © FIRST және LEGO Group. |
| Түпнұсқа авторының Firebase жобасы, ортақ кітапхана баптауы, әкімші беті және соларға қатысты тесттер мен құралдар | Ол біреудің жеке сервері. Кітапхана түймелері жасырылған. |
| Жоғарыдағы файлдарға ғана тәуелді тесттер, CI баптауы, `devDependencies` | Файлдары жоқ. |

## English summary

Added: Kazakh/Russian/English UI and block text; a 3D model of an EV3-style robot (modelled by eye from photos) with OBJ export; simplified push-force, per-mission direction/force/speed limits and fork lifting of loose pieces; an icon-based layout; loading your own mat photo; locally vendored Blockly. The default robot is now the EV3 preset with a fork attachment (arm ratio 1).

Removed: the bundled 3D field models and the official mat photo (no redistribution licence), the upstream author's Firebase configuration, the admin page, and the tests and tools that depended on those files.
