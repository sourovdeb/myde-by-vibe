<?php
/**
 * Sourov Agent - admin menu, page markup, asset enqueuing, nonce.
 */

class SA_Admin_Page {

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
	}

	public static function menu() {
		add_menu_page(
			'Sourov Agent',
			'Agent',
			'manage_options',
			'sourov-agent',
			array( __CLASS__, 'render' ),
			'dashicons-megaphone',
			59
		);
		add_submenu_page( 'sourov-agent', 'Chat', 'Chat', 'manage_options', 'sourov-agent', array( __CLASS__, 'render' ) );
		add_submenu_page( 'sourov-agent', 'Settings', 'Settings', 'manage_options', 'sa-settings', array( __CLASS__, 'render_settings' ) );
	}

	public static function is_our_page( $hook ) {
		return in_array( $hook, array( 'toplevel_page_sourov-agent', 'sourov-agent_page_sa-settings' ), true );
	}

	public static function assets( $hook ) {
		if ( ! self::is_our_page( $hook ) ) {
			return;
		}
		wp_enqueue_style( 'sa-agent', SA_PLUGIN_URL . 'assets/agent.css', array(), SA_VERSION );
		wp_enqueue_script( 'sa-agent', SA_PLUGIN_URL . 'assets/agent.js', array(), SA_VERSION, true );
		wp_localize_script( 'sa-agent', 'sa_api', array(
			'rest'         => esc_url_raw( rest_url( 'sa/v1/' ) ),
			'nonce'        => wp_create_nonce( 'sa_rest' ),
			'rest_nonce'   => wp_create_nonce( 'wp_rest' ),
			'settings'    => SA_Settings::public_view(),
			'greeting'    => SA_Settings::get()['greeting_name'] ?: 'Sourov',
			'site_url'    => home_url( '/' ),
			'site_title'  => get_bloginfo( 'name' ),
		) );
	}

	/** Tab shells: Files / Projects / Apps / Channels / Jobs are reserved for v2 (no fake data). */
	public static function render() {
		$settings = SA_Settings::public_view();
		?>
		<div class="wrap sa-wrap">
			<div class="sa-topbar">
				<div class="sa-brand"><span class="sa-logo">◉</span> Sourov Agent</div>
				<div class="sa-sitepill">Overview of <?php echo esc_html( home_url( '/' ) ); ?></div>
				<button id="sa-new-chat" class="button button-primary sa-newbtn">New chat</button>
			</div>
			<div class="sa-body">
				<aside class="sa-side">
					<nav class="sa-tabs">
						<button data-tab="chat" class="sa-tab active">✳ Chats</button>
						<button data-tab="skills" class="sa-tab">◆ Skills</button>
						<button data-tab="files" class="sa-tab sa-soon" title="v2">▤ Files</button>
						<button data-tab="projects" class="sa-tab sa-soon" title="v2">▦ Projects</button>
						<button data-tab="channels" class="sa-tab sa-soon" title="v2">⇄ Channels</button>
						<button data-tab="jobs" class="sa-tab sa-soon" title="v2">✓ Jobs</button>
						<button data-tab="settings" class="sa-tab">⚙ Settings</button>
					</nav>
					<div id="sa-chat-list" class="sa-chatlist"></div>
				</aside>
				<main class="sa-main">
					<section id="sa-panel-chat" class="sa-panel">
						<div id="sa-messages" class="sa-messages"></div>
						<div id="sa-chip-row" class="sa-chip-row"></div>
						<form id="sa-composer" class="sa-composer">
							<textarea id="sa-input" rows="2" placeholder="What would you like help with?" required></textarea>
							<button type="submit" id="sa-send" class="button button-primary">Send</button>
						</form>
						<p class="sa-status" id="sa-status"></p>
					</section>

					<section id="sa-panel-skills" class="sa-panel sa-hidden">
						<h2>What would you like help with?</h2>
						<p class="sa-dim">Pick a specialist, then the part of the job. All cards run locally through your own provider key.</p>
						<div id="sa-skill-cards" class="sa-cards"><em>Loading skills…</em></div>
					</section>

					<section id="sa-panel-files" class="sa-panel sa-hidden"><h2>Files</h2><p class="sa-dim">Coming in v2 - upload, link and reference files in chat.</p></section>
					<section id="sa-panel-projects" class="sa-panel sa-hidden"><h2>Projects</h2><p class="sa-dim">Coming in v2 - keep multi-step work organized.</p></section>
					<section id="sa-panel-channels" class="sa-panel sa-hidden"><h2>Channels</h2><p class="sa-dim">Coming in v2 - post results to your channels.</p></section>
					<section id="sa-panel-jobs" class="sa-panel sa-hidden"><h2>Jobs</h2><p class="sa-dim">Coming in v2 - scheduled agent jobs.</p></section>

					<section id="sa-panel-settings" class="sa-panel sa-hidden">
						<h2>Provider settings</h2>
						<p class="sa-dim">Any OpenAI-compatible /chat/completions endpoint works (Agnes, Mistral, OpenAI, local). Your key is stored in this site's database and used server-side only - it is never sent to the browser.</p>
						<form id="sa-settings-form">
							<table class="form-table sa-settings-table">
								<tr><th><label for="sa-base-url">Base URL</label></th>
									<td><input type="url" id="sa-base-url" name="base_url" class="regular-text" placeholder="https://apihub.agnes-ai.com/v1" value="<?php echo esc_attr( $settings['base_url'] ); ?>" /></td></tr>
								<tr><th><label for="sa-api-key">API key</label></th>
									<td>
										<input type="password" id="sa-api-key" name="api_key" class="regular-text" placeholder="<?php echo $settings['has_key'] ? esc_attr( 'configured (' . $settings['key_len'] . ' chars) - leave empty to keep' ) : 'sk-…'; ?>" autocomplete="off" />
										<span class="sa-dim" id="sa-key-state"><?php echo $settings['has_key'] ? esc_html( 'Key saved (' . $settings['key_len'] . ' chars).' ) : 'No key saved yet.'; ?></span>
									</td></tr>
								<tr><th><label for="sa-model">Model</label></th>
									<td><input type="text" id="sa-model" name="model" class="regular-text" placeholder="agnes-2.5-flash" value="<?php echo esc_attr( $settings['model'] ); ?>" /></td></tr>
								<tr><th><label for="sa-temp">Temperature</label></th>
									<td><input type="number" id="sa-temp" name="temperature" min="0" max="2" step="0.1" value="<?php echo esc_attr( $settings['temperature'] ); ?>" /></td></tr>
								<tr><th><label for="sa-maxtok">Max tokens</label></th>
									<td><input type="number" id="sa-maxtok" name="max_tokens" min="256" max="16384" step="256" value="<?php echo esc_attr( $settings['max_tokens'] ); ?>" /></td></tr>
								<tr><th><label for="sa-greet">Greeting name</label></th>
									<td><input type="text" id="sa-greet" name="greeting_name" class="small-text" value="<?php echo esc_attr( $settings['greeting_name'] ); ?>" /></td></tr>
								<tr><th>Extra credentials</th>
									<td>
										<div id="sa-creds" class="sa-creds"><em class="sa-dim">Stored server-side; values are never shown in the UI and are only referenced by name in context.</em></div>
										<p><button type="button" class="button" id="sa-add-cred">+ Add credential</button></p>
									</td></tr>
							</table>
							<p>
								<button type="submit" class="button button-primary">Save settings</button>
								<button type="button" class="button" id="sa-test-conn">Test connection</button>
								<span class="sa-status" id="sa-settings-status"></span>
							</p>
						</form>
						<p class="sa-dim">Presets: <button type="button" class="sa-preset" data-base="https://apihub.agnes-ai.com/v1" data-model="agnes-2.5-flash">Agnes</button>
						<button type="button" class="sa-preset" data-base="https://api.mistral.ai/v1" data-model="mistral-large-latest">Mistral</button>
						<button type="button" class="sa-preset" data-base="https://api.openai.com/v1" data-model="gpt-4o-mini">OpenAI</button></p>
					</section>
				</main>
			</div>
		</div>
		<?php
	}

	public static function render_settings() {
		// Settings live as a tab inside the main page; this submenu entry re-renders the same page on the settings tab.
		self::render();
	}
}
