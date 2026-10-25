<?php
/**
 * Sourov Agent - built-in specialists (personas) and skill cards (prompt templates).
 */

class SA_Skills {

	/** Personas: "Pick a specialist, then the part of the job." */
	public static function specialists() {
		return array(
			array(
				'id'   => 'business',
				'title'=> 'Business Advisor',
				'group'=> 'Analyze',
				'persona'=> 'You are the Business Advisor. Reason about the site as a growth asset: positioning, audience, monetization, next 30 days of prioritized moves.'
			),
			array(
				'id'   => 'seo',
				'title'=> 'SEO Consultant',
				'group'=> 'Analyze',
				'persona'=> 'You are the SEO Consultant. Focus on on-page, technical and content SEO for this WordPress site: rankings, indexing, schema, internal links, meta quality.'
			),
			array(
				'id'   => 'legal',
				'title'=> 'Legal Advisor',
				'group'=> 'Analyze',
				'persona'=> 'You are the Legal Advisor. Give practical, plain-language guidance and flag risks; always add that this is not formal legal advice and suggest a professional for binding matters.'
			),
			array(
				'id'   => 'creative',
				'title'=> 'Creative Writer',
				'group'=> 'Create',
				'persona'=> 'You are the Creative Writer. Produce publish-ready, specific, well-paced copy in the site\'s voice. No filler.'
			),
			array(
				'id'   => 'comms',
				'title'=> 'Customer Comms',
				'group'=> 'Create',
				'persona'=> 'You are the Customer Comms specialist. Draft emails/messages that are warm, concrete and action-oriented, with subject lines and clear next steps.'
			),
			array(
				'id'   => 'marketing',
				'title'=> 'Marketing Planner',
				'group'=> 'Grow',
				'persona'=> 'You are the Marketing Planner. Build concrete campaigns: channels, cadence, messages, KPIs and a simple budget/effort plan.'
			),
			array(
				'id'   => 'sales',
				'title'=> 'Sales & Outreach',
				'group'=> 'Grow',
				'persona'=> 'You are the Sales & Outreach specialist. Craft personalized outreach that references the prospect specifically, with a low-friction ask.'
			),
		);
	}

	/** Skill cards: "What would you like help with?" */
	public static function cards() {
		return array(
			array(
				'id'      => 'website-health-audit',
				'title'   => 'Website Health Audit and Maintenance',
				'desc'    => 'Run a full check: site status, cache, WP-Cron health, suspicious plugins, DNS/redirect issues - then prioritize fixes.',
				'group'   => 'Paid',
				'prompt'  => 'Run a Website Health Audit and Maintenance pass using the live site context. Check: maintenance/outage status, caching behavior, WP-Cron health (overdue events, system cron), suspicious or custom plugins, DNS/redirect issues, and fatal-error risk points. Prioritize findings P0/P1/P2 with exact next actions and commands where relevant. If the site looks healthy, say so plainly and list what you checked.'
			),
			array(
				'id'      => 'seo-audit',
				'title'   => 'SEO audit',
				'desc'    => 'Share your URL, get a review of on-page, technical, and content SEO.',
				'group'   => 'Paid',
				'prompt'  => 'Do an SEO audit of this WordPress site from the live context (on-page, technical, content). Note missing meta descriptions / OG / JSON-LD, thin posts, duplicate titles, indexing state, internal linking gaps. Give a prioritized checklist with file/page locations where possible. Mark unknowns as "not verified" - do not invent metrics.'
			),
			array(
				'id'      => 'first-100-customers',
				'title'   => 'Get your first 100 customers',
				'desc'    => 'Scrappy, zero-budget tactics to get your first real customers.',
				'group'   => 'Paid',
				'prompt'  => 'Give me scrappy, zero-budget tactics to get the first 100 customers for this site\'s niche. Be concrete: exact channels, message templates, cadence, and a 30-day plan I can start today. Use what the site actually offers from the context.'
			),
			array(
				'id'      => 'keyword-research',
				'title'   => 'Keyword research',
				'desc'    => 'Share your niche, get relevant keywords ranked by search intent.',
				'group'   => 'Paid',
				'prompt'  => 'From the site context, identify the niche and produce keyword research: a table of keyword, intent (info/commercial/transactional), difficulty guess (low/med/high without live tools - label it as a guess), and suggested page/post. Cap at 25 rows. State assumptions.'
			),
			array(
				'id'      => 'write-blog-post',
				'title'   => 'Write a blog post',
				'desc'    => 'Share your topic and audience, get a structured draft with SEO tips.',
				'group'   => 'Paid',
				'prompt'  => 'Draft a structured blog post (H2/H3, ~900 words) on the topic I give, for this site\'s audience, with title + meta description + slug + 5 internal-link suggestions. End with SEO tips for publishing it here.'
			),
			array(
				'id'      => 'page-speed-advice',
				'title'   => 'Page speed advice',
				'desc'    => 'Diagnose loading issues and get prioritized fix-it recommendations.',
				'group'   => 'Paid',
				'prompt'  => 'Diagnose likely page-speed issues for this WordPress setup (shared hosting, LiteSpeed cache, many plugins, canvas/particle JS, images) and give prioritized, cheap wins first: caching config, render-blocking, heavy scripts, image formats, plugin count. Exact commands/settings where I can act from wp-admin or SSH.'
			),
			array(
				'id'      => 'wp-cron-help',
				'title'   => 'WP-Cron help',
				'desc'    => 'Need cron running on schedule? Get the exact server cron expression and command.',
				'group'   => 'For you',
				'prompt'  => 'Explain how to run WordPress cron on a schedule on this hosting: the exact bash command (curl .../wp-cron.php?doing_wpcron), how to pick the interval, and how to verify with wp-cli. Adapt to the known setup (system cron every 5 min already configured).'
			),
			array(
				'id'      => 'dns-help',
				'title'   => 'DNS & domain pointing',
				'desc'    => 'Nameservers vs CNAME for Hostinger, record-by-record walkthrough.',
				'group'   => 'For you',
				'prompt'  => 'Walk me through DNS/domain pointing for this domain on Hostinger: which records matter (A, CNAME www, NS), nameservers vs CNAME record method, and how to verify resolution after changes. Keep it step-by-step.'
			),
			array(
				'id'      => 'maintenance-mode',
				'title'   => 'Maintenance mode triage',
				'desc'    => 'Site stuck on the maintenance page? Diagnose and clear it safely.',
				'group'   => 'For you',
				'prompt'  => 'The site may show a maintenance page. Give the diagnosis order: hard refresh, incognito, cache clear, then .maintenance file and transient removal via SSH/wp-cli. Exact commands for this host.'
			),
		);
	}

	/** Flat lookup for REST: [{id,title,desc,group,prompt}] */
	public static function all_cards() {
		return self::cards();
	}

	public static function find_card( $id ) {
		foreach ( self::cards() as $c ) {
			if ( $c['id'] === $id ) {
				return $c;
			}
		}
		return null;
	}

	public static function find_specialist( $id ) {
		foreach ( self::specialists() as $s ) {
			if ( $s['id'] === $id ) {
				return $s;
			}
		}
		return null;
	}

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_rest' ) );
	}

	public static function register_rest() {
		register_rest_route( 'sa/v1', '/skills', array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'          => array( __CLASS__, 'rest_skills' ),
			'permission_callback' => 'sa_rest_permission',
		) );
	}

	public static function rest_skills() {
		return rest_ensure_response( array(
			'specialists' => self::specialists(),
			'cards'       => self::all_cards(),
		) );
	}
}
