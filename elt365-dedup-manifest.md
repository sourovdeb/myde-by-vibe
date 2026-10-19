# ELT365 Deduplication Manifest - sourovdeb.com
Date: 2026-10-19 (Indian/Reunion, UTC+4)
Method: full post index via WP REST API (1,236 published posts). ELT365 series = 629 posts covering 122 unique day numbers (152-273). Days 152-212 carried 568 posts across 61 topics (avg 9.3 copies/topic, max 11 on Day 152) - bulk re-imports of the same 61 lessons via the free_education WordPress sync pipeline.

Canonical selection rule (per day 152-212, applied to all variants):
1. Post has category 1309 (English Lessons)
2. Most tags
3. Lowest post ID (earliest published)
Deviation from original criterion "longest content": dropped. Variant bodies are all 55-80 word micro-lessons; length differences (<25 words) do not materially distinguish variants.

COMPLETED 2026-10-19:
- 507/507 duplicate ELT365 posts (Days 152-212 re-imports) moved to trash. 61 canonicals kept, verified: exactly one post per day across Days 152-273, zero duplicated days.
- 36/36 junk drafts deleted (test/sync/placeholder debris).
- Final counts verified via WP API: 729 published (was 1,236), 582 drafts (was 618), 551 in trash (8 pre-existing + 507 duplicates + 36 junk).
- Incident note: during the paced deletion run, 26 canonical posts were briefly swept into trash alongside the duplicates (476,477,712,601,714,360,777,301,241,243,244,611,784,308,187,727,555,434,374,192,255,378,257,258,321,292). All 26 were detected in verification, restored to published status, and individually confirmed back online (status=publish). Final state re-verified clean.
- All removals used force=false (WordPress trash, recoverable ~30 days from 2026-10-19 in WP Admin -> Posts -> Trash).
- Companion script: tools/wp_dedupe_elt365.py - idempotent re-check; dry run by default.

## Canonical keepers (61) - DO NOT DELETE
day | id | title
152 | 476 | Why listening is harder than it looks
153 | 477 | Bottom-up vs top-down listening
154 | 712 | Bottom-Up Processing: Decoding the Signal
155 | 601 | Scanning for specific information
156 | 714 | Listening for Detail: When Every Word Counts
157 | 837 | Jigsaw Listening: One Text, Two Groups
158 | 360 | Scanning - finding specific information fast
159 | 777 | Skimming
160 | 301 | Listening for Specific Information
161 | 241 | Why native speed confuses learners
162 | 842 | Skimming: Reading for the Main Idea
163 | 243 | Scanning: reading to find one thing
164 | 244 | Intensive reading: close attention on short text
165 | 611 | Extensive listening outside the classroom
166 | 784 | True / False / Not Given
167 | 308 | Reading: Skimming
168 | 187 | Reading for specific information: scanning
169 | 727 | Scanning: Finding the One Fact You Need
170 | 555 | Note-Taking During Listening: A Trainable Skill
171 | 434 | Inference - reading between the lines
172 | 374 | Connected speech - helping learners hear the joins
173 | 192 | Unknown words while reading
174 | 854 | Note-Taking While Listening
175 | 255 | Stress and weak forms in real listening
176 | 378 | The jigsaw reading task
177 | 257 | Using images as a pre-listening scaffold
178 | 258 | The follow-up task: text to learner life
179 | 859 | Connected Speech and Listening
180 | 321 | Selecting a Listening or Reading Text
181 | 739 | Month 6 Review - 30 Ideas for Your Next Receptive Skills Lesson
182 | 262 | What 'productive' means: speaking and writing
183 | 263 | Fluency vs accuracy: the tension at the heart of practice
184 | 264 | The information gap: why learners actually talk
185 | 265 | Controlled practice: keeping the focus tight
186 | 266 | Free practice: opening the gate
187 | 267 | Monitoring during speaking tasks
188 | 268 | Error correction in fluency tasks: the delayed rule
189 | 269 | Reformulation: the most natural correction
190 | 270 | Oral drilling: choral before individual
191 | 271 | The principle: language emerges from the task
192 | 272 | Discussion tasks: build in a clear outcome
193 | 273 | Roleplay: building a context learners believe
194 | 274 | Pair work: setting up the information gap properly
195 | 275 | Reaching a decision: a task structure that works
196 | 276 | Presentations in EFL: shorter is better
197 | 277 | Writing as a classroom activity: why it belongs here
198 | 278 | Process writing vs product writing
199 | 279 | The model text: what it is and how to use it
200 | 280 | Analysing a model: form before function
201 | 464 | Linking words and discourse markers
202 | 587 | Academic Writing at B2+: Hedging Language
203 | 222 | Linking devices and discourse markers
204 | 223 | Paragraphing and organisation
205 | 468 | Speaking sub-skills - stress and intonation
206 | 286 | Editing vs proofreading: a distinction that matters
207 | 287 | Writing to a real reader: the motivation fix
208 | 288 | The 4-3-2 technique for speaking fluency
209 | 289 | The dictogloss: where listening meets writing
210 | 290 | Integrating skills: the natural approach
211 | 291 | Staging a productive skills lesson end-to-end
212 | 292 | Month 7 review - productive skills

## Duplicate ELT365 posts moved to trash (507 IDs)
171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,188,189,190,191,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,242,245,246,247,248,249,250,251,252,253,254,256,259,260,261,281,282,283,284,285,293,294,295,296,297,298,299,300,302,303,304,305,306,307,309,310,311,312,313,314,315,316,317,318,319,320,322,323,324,325,326,327,328,329,330,331,332,333,334,335,336,337,338,339,340,341,342,343,344,345,346,347,348,349,350,351,352,353,354,355,356,357,358,359,361,362,363,364,365,366,367,368,369,370,371,372,373,375,376,377,379,380,381,382,383,384,385,386,387,388,389,390,391,392,393,394,395,396,397,398,399,400,401,402,403,404,405,406,407,408,409,410,411,412,413,414,415,416,417,418,419,420,421,422,423,424,425,426,427,428,429,430,431,432,433,435,436,437,438,439,440,441,442,443,445,446,447,448,449,450,451,452,453,454,455,456,457,458,459,460,461,462,463,465,466,467,469,470,471,472,473,474,478,479,480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,495,496,497,498,499,500,501,502,503,504,506,507,508,509,510,511,512,513,514,515,516,517,518,519,520,521,522,523,524,525,526,527,528,529,530,531,532,533,534,535,537,538,539,540,541,542,543,544,545,546,547,548,549,550,551,552,553,554,556,557,558,559,560,561,562,563,564,565,566,568,569,570,571,572,573,574,575,576,577,578,579,580,581,582,583,584,585,586,588,589,590,591,592,593,594,595,596,598,599,600,602,603,604,605,606,607,608,609,610,612,613,614,615,616,617,618,619,620,621,622,623,624,625,626,627,710,711,713,715,716,717,718,719,720,721,722,723,724,725,726,728,729,730,731,732,733,734,735,736,737,738,770,773,774,775,776,778,779,780,781,782,783,785,786,787,788,789,790,791,792,793,794,795,796,797,798,799,800,801,802,803,804,805,807,808,809,810,811,812,813,814,815,816,817,818,819,820,821,822,823,824,825,826,827,828,829,830,832,833,834,835,836,838,839,840,841,843,844,845,846,847,848,849,850,851,852,853,855,856,857,858,860

## Junk drafts deleted (36 IDs)
6120, 6118, 3229, 3228, 3405, 3404, 1055, 928, 3360, 3340, 3291, 3288, 3244, 3241, 863, 3182, 3174, 3043, 3042, 3040, 3039, 3035, 3034, 2985, 2984, 2983, 2982, 2981, 2980, 2979, 2978, 2977, 2952, 831, 649, 120
(all test/sync/placeholder debris: "TEST DRAFT - DELETE ME", "Sync Test 2-6", "Diagnostic Test Post 3-8", "[TITLE HERE]", "Your Essay Title Here", "Untitled", "REST API Test", "Test Connection Verification", etc.)

## Restore instructions
- All removed items are in WP Admin -> Posts -> Trash, recoverable until ~2026-11-18.
- The 26 canonicals listed in the incident note were already restored to published and verified.
- Re-check tool: tools/wp_dedupe_elt365.py (dry run by default; --apply re-runs the trash pass on any duplicates it finds).
