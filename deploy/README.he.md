# התקנה מלאה: GymFlow + OpenClaw + Codex + Telegram על GCP

מדריך זה מקים שרת production מלא ומגדיר את זרימת העבודה הבאה:

```text
Telegram
  → OpenClaw + Codex משנים קוד בענף feature/*
  → Pull Request אל staging
  → CI + פריסה ציבורית ל-GitHub Pages
  → בדיקה ידנית שלך
  → Pull Request מ-staging אל main
  → merge ידני
  → שרת GCP מזהה main חדש
  → גיבוי PostgreSQL
  → Docker build + deploy
  → health check ציבורי
  → הצלחה או rollback אוטומטי
```

## עקרונות האבטחה

- OpenClaw רץ תחת משתמש Linux נפרד בשם `openclaw`.
- ה־Gateway מאזין רק ל־`127.0.0.1:18789`. אין לפתוח פורט זה ב־GCP או ב־UFW.
- רק Telegram user ID מספרי אחד מורשה לשלוח פקודות. קבוצות חסומות.
- OpenClaw אינו חבר בקבוצת `docker` ואינו מקבל את `/var/run/docker.sock`. חברות בקבוצת Docker שוות מעשית להרשאת root.
- פעולות Docker עוברות דרך `/usr/local/sbin/gymflow-ops`, שמקבל רק שבע פקודות קבועות.
- פעולות חריגות דורשות אישור Telegram מסוג `/approve`; אם אין ערוץ אישור זמין הפעולה נדחית.
- production אינו נבנה מתיקיית העבודה של הסוכן. הוא מקבל רק commit קיים מ־`origin/main`.
- סודות נשמרים תחת `/etc/gymflow` בהרשאת `0600` ואינם נכנסים ל־Git או ל־Docker image.

## דרישות מוקדמות

1. פרויקט GCP פעיל.
2. דומיין עם אפשרות ליצור רשומת DNS מסוג A.
3. מאגר GitHub המכיל את הקבצים שבחבילה זו.
4. חשבון ChatGPT/Codex שתומך בהתחברות OpenClaw.
5. Telegram bot שיצרת דרך `@BotFather`.
6. Numeric Telegram user ID ו־chat ID.
7. GitHub machine user או GitHub App עבור OpenClaw. מומלץ לא להשתמש בחשבון האישי שלך, משום שהיוצר של PR אינו יכול לאשר את ה־PR של עצמו.

## שלב 1 — יצירת VM ב־GCP

מפרט התחלתי מומלץ:

- Ubuntu 24.04 LTS.
- לפחות `e2-medium` עם 4GB RAM; אם build נכשל מחוסר זיכרון, עבור ל־8GB.
- Balanced Persistent Disk של 40GB לפחות.
- כתובת IP חיצונית סטטית.
- Shielded VM פעיל.
- Service account ללא הרשאות ניהול מיותרות; עבור Ops Agent מספיקות הרשאות כתיבת logs ו־metrics.

הגדר Firewall ב־GCP:

- TCP 80 מכל העולם.
- TCP 443 מכל העולם.
- UDP 443 אופציונלי עבור HTTP/3.
- TCP 22 רק מכתובת הניהול שלך, או דרך IAP.
- אל תפתח 3000, 5432, 8080 או 18789.

צור רשומת DNS מסוג A מהדומיין אל ה־IP הסטטי והמתן עד ש־DNS מתעדכן.

מומלץ להפעיל:

- OS Login ו־2FA עבור SSH.
- Google Cloud Ops Agent דרך לשונית Observability של ה־VM.
- Snapshot Schedule יומי עם retention של 14–30 יום.

## שלב 2 — הכנת Telegram ו־GitHub

### Telegram

1. פתח שיחה עם `@BotFather`.
2. הפעל `/newbot` ושמור את ה־token במקום בטוח.
3. שלח הודעה לבוט החדש.
4. קבל את numeric user ID ואת chat ID. אל תכניס username לרשימת ההרשאות; המתקין מקבל רק ID מספרי.

### GitHub token עבור OpenClaw

צור fine-grained token עבור machine user שמוגבל למאגר GymFlow בלבד:

- Contents: Read and write.
- Pull requests: Read and write.
- Actions: Read.
- Metadata: Read.

אל תיתן token זה הרשאת Administration. את הגדרת branch protection מבצעים פעם אחת עם חשבון repository admin, ולאחר מכן מתנתקים ממנו.

## שלב 3 — העלאת החבילה לשרת

התחבר ב־SSH ושכפל את המאגר:

```bash
git clone https://github.com/menibl/rubigym.git
cd rubigym
```

אם המאגר פרטי, בצע תחילה `gh auth login` עם החשבון שלך או השתמש ב־read-only deploy key. אין לשים token בתוך כתובת Git.

## שלב 4 — התקנה אוטומטית מלאה

הרץ:

```bash
sudo bash deploy/scripts/install-all.sh "$USER"
```

הסקריפט יבקש באופן אינטראקטיבי:

- דומיין production.
- דוא"ל עבור תעודת TLS.
- כתובת מאגר GitHub.
- origin של GitHub Pages.
- Telegram user ID ו־chat ID.
- Telegram bot token בהקלדה מוסתרת.
- OpenAI API key עבור עוזר האימונים; אפשר להשאיר ריק ולהגדיר מאוחר יותר.
- האם להתחיל עם תשלום Cardcom במצב demo.
- פרטי Cardcom אם בחרת production payment.

הסקריפט יבצע:

- התקנת Docker, Compose, GitHub CLI, UFW, fail2ban ו־unattended upgrades.
- ביטול SSH בסיסמה רק לאחר שווידא שקיים `authorized_keys` למשתמש הניהול.
- יצירת סודות אקראיים ל־PostgreSQL, חתימת תשלומים וסנכרון state.
- התקנת OpenClaw תחת משתמש ייעודי.
- Telegram allowlist, חסימת קבוצות ו־redaction של מידע רגיש.
- הגדרת exec policy במצב `ask`, `strictInlineEval` ו־fallback מסוג deny.
- התקנת Caddy, האפליקציה ו־PostgreSQL ב־Docker.
- ניטור כל דקה, בדיקת אבטחה יומית וגיבוי יומי.
- בדיקה אוטומטית של `main` כל חמש דקות ופריסה רק כאשר ה־commit השתנה.

הסקריפט מסרב להמשיך אם קבצי production כוללים placeholder כמו `CHANGE_ME`, `example.com` או `your-production-domain`.

## שלב 5 — פעולות חד־פעמיות לאחר המתקין

### התחברות Codex

```bash
sudo -u openclaw -H /home/openclaw/.local/openclaw/bin/openclaw \
  models auth login --provider openai --device-code
```

פתח במחשב האישי את הכתובת שתוצג והשלם את ההתחברות. לאחר מכן:

```bash
sudo -u openclaw -H /home/openclaw/.local/openclaw/bin/openclaw \
  models list --provider openai
sudo -u openclaw -H /home/openclaw/.local/openclaw/bin/openclaw \
  models set openai/gpt-5.5
sudo systemctl enable --now openclaw.service
sudo -u openclaw -H /home/openclaw/.local/openclaw/bin/openclaw \
  security audit --deep
```

### התחברות GitHub של machine user

```bash
sudo -u openclaw -H gh auth login --hostname github.com --git-protocol https
sudo -u openclaw -H gh auth setup-git
sudo -u openclaw -H gh repo clone menibl/rubigym \
  /home/openclaw/.openclaw/workspace/gymflow-management
sudo -u openclaw -H git -C /home/openclaw/.openclaw/workspace/gymflow-management \
  config user.name "GymFlow OpenClaw"
sudo -u openclaw -H git -C /home/openclaw/.openclaw/workspace/gymflow-management \
  config user.email "openclaw@example.com"
```

החלף את שם המאגר והדוא"ל לפי הצורך.

### יצירת staging ו־branch protection

התחבר זמנית ב־`gh` עם חשבון repository admin והריץ:

```bash
bash deploy/scripts/configure-github-repository.sh menibl/rubigym
```

הסקריפט:

- יוצר `staging` מ־`main` אם הוא אינו קיים.
- מחייב PR, CI, שיחות פתורות והיסטוריה לינארית ב־`staging` וב־`main`.
- חוסם force-push ומחיקת ענפים מוגנים.
- מחייב אישור reviewer אחד.
- מוסיף ל־`main` בדיקת `promotion-gate`, שמוודאת שה־PR מגיע מ־`staging` ושאותו commit בדיוק נפרס בהצלחה ל־GitHub Pages.

לאחר מכן התנתק מחשבון ה־admin. OpenClaw ממשיך לעבוד רק עם machine user מוגבל.

### משתני GitHub Pages

ב־GitHub פתח Settings → Secrets and variables → Actions → Variables והוסף:

- `PAYMENT_API_URL=https://YOUR_PRODUCTION_DOMAIN`
- `AI_API_URL=https://YOUR_PRODUCTION_DOMAIN`

ודא שב־Settings → Pages מקור הפריסה הוא GitHub Actions. ה־workflow הציבורי רץ רק עבור `staging`, לא עבור `main`.

## שלב 6 — בדיקות קבלה

```bash
curl --fail https://YOUR_PRODUCTION_DOMAIN/healthz
sudo /usr/local/sbin/gymflow-ops status
sudo systemctl is-active \
  openclaw \
  gymflow-monitor.timer \
  gymflow-production-deploy.timer \
  gymflow-daily-management.timer \
  fail2ban \
  unattended-upgrades
sudo ufw status verbose
sudo ss -lntup
sudo -u openclaw -H /home/openclaw/.local/openclaw/bin/openclaw status --deep
sudo -u openclaw -H /home/openclaw/.local/openclaw/bin/openclaw security audit --deep
sudo -l -U openclaw
```

בפלט `ss`:

- 80/443 יכולים להיות ציבוריים.
- 18789 חייב להופיע רק על `127.0.0.1`.
- 5432 ו־8080 אינם אמורים להיות חשופים לציבור.

בדוק שהמשתמש `openclaw` אינו בקבוצת Docker:

```bash
id openclaw
```

## שלב 7 — עבודה מהטלגרם

אפשר לכתוב לבוט בשפה טבעית. דוגמאות מומלצות:

### שינוי קוד

```text
פתח שינוי חדש בשם fix-member-search.
תקן את החיפוש במסך המתאמנים. אל תשנה קבצים לא קשורים.
הרץ את כל הבדיקות והראה לי diff מסכם.
```

OpenClaw יפעיל:

```bash
gymflow-dev start fix-member-search
gymflow-dev test
```

לאחר שבדקת את הסיכום:

```text
פרסם את השינוי ל-staging עם הודעת commit: Fix member search filtering
```

לפני `gymflow-dev publish` הבוט צריך להציג את ה־diff ותוצאות הבדיקות ולבקש אישור מפורש. הפקודה יוצרת commit, דוחפת `feature/*` ופותחת PR ל־`staging`; היא אינה ממזגת.

אחרי שבדיקות ה־PR עברו, הבוט מציג את מספר ה־PR ואת ה־SHA המדויק ומבקש אישור יחיד ומפורש, למשל:

```text
מאשר merge של PR #21 ל-staging
```

רק אז הוא מפעיל `gymflow-dev stage 21`. הפקודה מוודאת מחדש שה־PR פתוח, שאינו draft, שמקורו `feature/*`, שהיעד הוא `staging`, שה־SHA לא השתנה ושכל הבדיקות עברו. לאחר המיזוג היא ממתינה ל־CI ולפריסת GitHub Pages של אותו SHA ומחזירה את כתובת הבדיקה:

```text
https://menibl.github.io/rubigym/
```

### בדיקת staging

אחרי merge ל־`staging`, GitHub Actions מריץ CI ומפרסם את האתר הציבורי. בדוק ידנית:

- כניסה והרשאות.
- מסכי מאמן/מתאמן/מנהל.
- יצירת תוכנית אימון.
- תשלום demo או Cardcom.
- תצוגה בנייד.
- שאין שגיאות API או CORS.

### קידום ל־production

```text
בדקתי את staging והוא תקין. פתח PR לקידום ל-production.
```

OpenClaw מפעיל `gymflow-dev promote`. הפקודה מסרבת אם הפריסה הציבורית האחרונה אינה success או אם ה־SHA אינו זהה ל־`origin/staging`.

לאחר פתיחת PR הקידום, OpenClaw ממתין לבדיקות ומציג את מספר ה־PR ואת SHA של `staging`. רק אחרי שבדקת את Pages הוא מבקש אישור מדויק, למשל:

```text
מאשר merge ל-main של PR #22 ופריסה אוטומטית לקומיט <SHA>
```

לאחר האישור הוא מפעיל `gymflow-dev release 22`. הפקודה מוודאת שה־PR הוא רק `staging → main`, שה־SHA זהה לגרסה שנבדקה ב־Pages ושכל בדיקות הקידום הצליחו, ואז ממזגת. ה־production timer בשרת מזהה את `main` החדש בתוך חמש דקות ומפרסם ל־GCP. OpenClaw עוקב באמצעות `gymflow-prod status` ומדווח בטלגרם רק לאחר שה־SHA החדש פעיל ובריא.

המילה `מאשר` לבדה תקפה רק כתשובה ישירה לבקשת אישור אחת וברורה שהבוט שלח מיד לפני כן, ובה הופיעו PR, יעד ו־SHA. הודעה אחרת באמצע, שינוי SHA או בדיקה שנכשלה מבטלים את האישור.

### עדכון workflow של OpenClaw בשרת קיים

אחרי שהשינוי הזה הגיע ל־`main` ונפרס, מריצים פעם אחת מתוך ה־release/checkout המעודכן:

```bash
sudo bash deploy/scripts/update-openclaw-workflow.sh "$(pwd)/deploy"
```

הסקריפט מעדכן את כללי הסוכן, פקודות Telegram וה־wrappers המוגבלים, מאמת את התצורה ומאתחל רק את שירות OpenClaw. הוא אינו מוסיף את OpenClaw לקבוצת Docker ואינו חושף את ה־gateway.

### ניהול production

פקודות טבעיות אפשריות:

```text
הצג מצב production.
הצג 200 שורות לוג אחרונות.
הרץ בדיקת אבטחה.
בצע rollback לגרסה הקודמת.
```

הפקודות הקשיחות הן:

```bash
sudo /usr/local/sbin/gymflow-ops status
sudo /usr/local/sbin/gymflow-ops logs
sudo /usr/local/sbin/gymflow-ops deploy-main
sudo /usr/local/sbin/gymflow-ops rollback
sudo /usr/local/sbin/gymflow-ops restart-app
sudo /usr/local/sbin/gymflow-ops security-audit
sudo /usr/local/sbin/gymflow-ops daily
```

`deploy-main`, `rollback` ו־`restart-app` מחייבים אישור מפורש בטלגרם. OpenClaw משתמש ב־`/usr/local/bin/gymflow-prod`, שמעביר רק שם פעולה יחיד ל־broker המוגבל. אין פקודת shell כללית ואין אפשרות להעביר ארגומנטים חופשיים ל־broker.

לאחר שינוי ערך ב־`/etc/gymflow/production.env`, לרבות `OPENAI_API_KEY`, יש להפעיל `restart-app`. הפקודה יוצרת מחדש את קונטיינר האפליקציה כדי לטעון את משתני הסביבה המעודכנים; אתחול רגיל של קונטיינר קיים אינו טוען אותם מחדש. אין צורך לבצע `deploy-main` אם קוד האפליקציה לא השתנה.

## שלב 8 — פריסה, גיבוי ו־rollback

בכל commit חדש ב־main:

1. נלקח SHA מדויק מ־GitHub.
2. נוצרת release directory חדשה מתוך `git archive`; אין קבצים לא־committed.
3. לפני החלפה נוצר `pg_dump` דחוס.
4. נבנה image בשם `gymflow:<40-char-sha>`.
5. Compose מעדכן את השירותים.
6. מתבצע health check מול הדומיין הציבורי.
7. במקרה כשל הגרסה הקודמת מופעלת מחדש אוטומטית.
8. נשלחת הודעת Telegram על התחלה, הצלחה, כשל או rollback.

מצב הפריסה נשמר ב־`/var/lib/gymflow-deploy`. releases נמצאים ב־`/opt/gymflow/releases`, וגיבויים ב־`/var/backups/gymflow`.

Rollback ידני:

```bash
sudo /usr/local/sbin/gymflow-ops rollback
```

Rollback של קוד אינו בהכרח rollback של schema. כל migration עתידי חייב להיות backward-compatible לפחות לגרסה אחת אחורה.

## אימות טלפוני באמצעות Pulseem

השרת שולח קודי OTP דרך `POST https://api.pulseem.com/api/v1/SmsApi/SendSms`. המפתח נשלח בכותרת `APIKey` ונשמר רק בקובץ `/etc/gymflow/production.env` בהרשאות `0600`; אין להוסיף אותו למשתנה שמתחיל ב־`VITE_`, ל־Git או ל־GitHub Secrets של סביבת Pages.

הגדרות הייצור הנדרשות:

```dotenv
PULSEEM_API_KEY=
PULSEEM_FROM_NUMBER=
PULSEEM_PHONE_FORMAT=local
SMS_OTP_SIGNING_SECRET=
SMS_TEST_MODE=false
```

`PULSEEM_FROM_NUMBER` חייב להיות שולח שאושר בחשבון Pulseem. ברירת המחדל שולחת מספרים ישראליים בפורמט מקומי; אם החשבון דורש קידומת בינלאומית יש להגדיר `PULSEEM_PHONE_FORMAT=international`. את `SMS_OTP_SIGNING_SECRET` יש ליצור באמצעות `openssl rand -hex 48`. קוד ה־OTP נשמר במסד הנתונים כ־HMAC בלבד, תקף לחמש דקות, מוגבל לחמישה ניסיונות ולחמש בקשות בשעה לכל מספר ומטרה.

GitHub Pages ממשיך לעבוד במצב הדגמה מקומי עם הקוד `1111` ואינו פונה ל־Pulseem. Production חייב לפעול עם `SMS_TEST_MODE=false`.

## שלב 9 — ניהול יומי

הטיימרים המותקנים:

- `gymflow-monitor.timer`: בדיקה כל דקה והתראות תקלה/recovery.
- `gymflow-production-deploy.timer`: בדיקת main כל חמש דקות.
- `gymflow-security-audit.timer`: OpenClaw security audit יומי.
- `gymflow-daily-management.timer`: גיבוי DB ודוח מצב יומי.

בדיקה:

```bash
systemctl list-timers 'gymflow-*' --all
journalctl -u gymflow-monitor.service -n 100 --no-pager
journalctl -u gymflow-production-deploy.service -n 100 --no-pager
journalctl -u gymflow-daily-management.service -n 100 --no-pager
```

הגיבוי המקומי אינו מספיק בפני מחיקת VM או פגיעה בדיסק. חובה להוסיף GCP Snapshot Schedule, ובהמשך להעביר גיבויי PostgreSQL מוצפנים ל־Cloud Storage עם retention ו־Object Versioning.

## תחזוקה ועדכונים

- עדכן OpenClaw קודם בסביבת בדיקה, הרץ `doctor`, `config validate` ו־`security audit --deep`, ורק אז production.
- אל תתקין skills או plugins ממקור שאינו מאומת.
- סובב מיד Telegram token, GitHub token, OAuth, OpenAI key ופרטי Cardcom אם יש חשד לדליפה.
- בצע restore test לגיבוי PostgreSQL ול־GCP snapshot לפחות אחת לרבעון.
- בדוק שבועית מקום בדיסק, failed systemd units, fail2ban ו־Cloud Monitoring alerts.

## התקנה ידנית במקום install-all

אם ברצונך להריץ כל שלב בנפרד:

```bash
sudo bash deploy/scripts/bootstrap-server.sh "$USER"
# צור ידנית:
# /etc/gymflow/production.env
# /etc/gymflow/production.conf
# /etc/gymflow/monitor.env
# /etc/gymflow/secrets/telegram-bot-token
sudo bash deploy/scripts/install-openclaw.sh TELEGRAM_USER_ID latest
sudo bash deploy/scripts/install-monitoring.sh "$(pwd)/deploy"
sudo bash deploy/scripts/install-production-automation.sh "$(pwd)/deploy"
sudo bash deploy/scripts/grant-openclaw-docker-access.sh "$(pwd)/deploy"
```

תבניות ההגדרה הן:

- `deploy/.env.example`
- `deploy/monitor.env.example`
- `deploy/production.conf.example`

## הסרה או עצירת אוטומציה

עצירה זמנית של promotion אוטומטי מ־main:

```bash
sudo systemctl disable --now gymflow-production-deploy.timer
```

עצירת OpenClaw אינה עוצרת את הניטור העצמאי:

```bash
sudo systemctl stop openclaw.service
systemctl status gymflow-monitor.timer
```

אין למחוק volumes של Docker בזמן הסרה ללא גיבוי מאומת; `postgres_data` מכיל את מסד הנתונים.
