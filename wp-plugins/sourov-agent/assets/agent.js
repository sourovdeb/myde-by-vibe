/* Sourov Agent admin UI (vanilla, no external deps). Loaded only on agent pages. */
(function () {
	'use strict';
	if (typeof sa_api === 'undefined') return;

	var REST = sa_api.rest, NONCE = sa_api.nonce;
	var state = {
		convId: 0,
		messages: [],
		specialist: '',
		skill: '',
		busy: false,
		cards: [],
		specialists: []
	};

	function $(id) { return document.getElementById(id); }
	function esc(s) {
		return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}
	/* Minimal markdown: fenced code, inline code, bold, bullets. Everything else escaped. */
	function renderMd(text) {
		var parts = String(text).split(/```/);
		var html = '';
		for (var i = 0; i < parts.length; i++) {
			if (i % 2 === 1) {
				var body = parts[i].replace(/^[a-zA-Z0-9_-]*\n/, '');
				html += '<pre class="sa-pre">' + esc(body) + '</pre>';
			} else {
				var p = esc(parts[i])
					.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
					.replace(/^### (.*)$/gm, '<h4>$1</h4>')
					.replace(/^## (.*)$/gm, '<h3>$1</h3>')
					.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
				var lines = p.split('\n');
				var listOpen = false, out = [];
				for (var j = 0; j < lines.length; j++) {
					var ln = lines[j];
					var m = ln.match(/^\s*[-*] (.*)$/);
					if (m) {
						if (!listOpen) { out.push('<ul>'); listOpen = true; }
						out.push('<li>' + m[1] + '</li>');
					} else {
						if (listOpen) { out.push('</ul>'); listOpen = false; }
						out.push(ln);
					}
				}
				if (listOpen) out.push('</ul>');
				html += '<div class="sa-md">' + out.join('\n').replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>') + '</div>';
			}
		}
		return html;
	}

	function api(path, opts) {
		opts = opts || {};
		opts.method = opts.method || 'GET';
		var h = { 'X-SA-Nonce': NONCE, 'Content-Type': 'application/json' };
		if (sa_api.rest_nonce) h['X-WP-Nonce'] = sa_api.rest_nonce; // cookie-auth REST requests need this or the session counts as guest
		opts.headers = Object.assign(h, opts.headers || {});
		if (opts.body !== undefined) opts.body = JSON.stringify(opts.body);
		return fetch(REST + path, opts).then(function (r) {
			return r.json().then(function (data) {
				if (!r.ok) throw new Error((data && (data.message || data.error)) || ('HTTP ' + r.status));
				return data;
			});
		});
	}

	function addMsg(role, text) {
		state.messages.push({ role: role, content: text });
		if (state.messages.length > 20) state.messages = state.messages.slice(-20);
		var div = document.createElement('div');
		div.className = 'sa-msg ' + (role === 'user' ? 'sa-user' : 'sa-assistant');
		var bubble = document.createElement('div');
		bubble.className = 'sa-bubble';
		bubble.innerHTML = role === 'user' ? esc(text).replace(/\n/g, '<br>') : renderMd(text);
		div.appendChild(bubble);
		$('sa-messages').appendChild(div);
		$('sa-messages').scrollTop = $('sa-messages').scrollHeight;
	}

	function chipRow() {
		var row = $('sa-chip-row');
		row.innerHTML = '';
		if (state.specialist) {
			var s = state.specialists.filter(function (x) { return x.id === state.specialist; })[0];
			if (s) row.appendChild(chip('specialist', s.title, 'sp-' + s.id));
		}
		if (state.skill) {
			var c = state.cards.filter(function (x) { return x.id === state.skill; })[0];
			if (c) row.appendChild(chip('skill', c.title, 'sk-' + c.id));
		}
		function chip(kind, label, key) {
			var b = document.createElement('button');
			b.className = 'sa-chip';
			b.textContent = label + ' ✕';
			b.title = 'Remove ' + kind;
			b.onclick = function () {
				if (kind === 'specialist') state.specialist = '';
				else state.skill = '';
				chipRow();
			};
			return b;
		}
	}

	function status(text, isErr) {
		var el = $('sa-status');
		el.textContent = text;
		el.className = 'sa-status' + (isErr ? ' sa-err' : '');
	}

	function send(input) {
		if (state.busy) return;
		var text = input.trim();
		if (!text) return;
		if (!sa_api.settings.configured) {
			status('Provider not configured yet - open Settings and add your API key, base URL and model.', true);
			return;
		}
		state.busy = true;
		$('sa-send').disabled = true;
		addMsg('user', text);
		status('Thinking…');
		input = '';
		$('sa-input').value = '';

		api('chat', {
			method: 'POST',
			body: {
				conv_id: state.convId,
				messages: state.messages,
				specialist: state.specialist,
				skill: state.skill,
				save: true
			}
		}).then(function (r) {
			state.busy = false;
			$('sa-send').disabled = false;
			if (r.ok) {
				state.convId = r.conv_id || state.convId;
				addMsg('assistant', r.reply);
				status('Model: ' + (r.model || 'n/a') + ' · saved as chat #'+ (r.conv_id || '?'));
			} else {
				addMsg('assistant', '⚠ ' + (r.error || 'Unknown provider error.'));
				status(r.error || 'Error.', true);
			}
			loadChatList();
		}).catch(function (e) {
			state.busy = false;
			$('sa-send').disabled = false;
			state.messages.pop(); // drop the user msg that got no answer
			status('Request failed: ' + e.message, true);
		});
	}

	function newChat() {
		state.convId = 0;
		state.messages = [];
		state.skill = '';
		$('sa-messages').innerHTML = '';
		hero();
		chipRow();
		switchTab('chat');
	}

	function hero() {
		var g = sa_api.greeting_name || 'there';
		var d = document.createElement('div');
		d.className = 'sa-hero';
		d.innerHTML =
			'<div class="sa-hero-hi">नमस्ते 👋 Hey ' + esc(g) + '</div>' +
			'<div class="sa-hero-sub">Your AI agent for ' + esc(sa_api.site_title || 'your site') + '. Previous chats are right here, alongside your support history. One click and I\'ll run a full check on ' + esc(sa_api.site_url) + '.</div>' +
			'<button class="button button-primary" id="sa-hero-check">Run full site check</button>' +
			'<div class="sa-dim" style="margin-top:8px">or pick a specialist / skill on the right →</div>';
		$('sa-messages').appendChild(d);
		$('sa-hero-check').onclick = function () {
			state.skill = 'website-health-audit';
			chipRow();
			send('Run the Website Health Audit and Maintenance pass now.');
		};
	}

	function loadChatList() {
		api('conversations').then(function (list) {
			var box = $('sa-chat-list');
			box.innerHTML = '';
			if (!list.length) {
				box.innerHTML = '<div class="sa-dim sa-noconv">No saved chats yet.</div>';
				return;
			}
			list.slice(0, 15).forEach(function (c) {
				var b = document.createElement('button');
				b.className = 'sa-chatitem';
				b.textContent = c.title || ('Chat #' + c.id);
				b.title = 'Opened ' + new Date(c.updated * 1000).toLocaleDateString() + ' · click to open, × to delete';
				b.onclick = function () { openConv(c.id); };
				var x = document.createElement('span');
				x.className = 'sa-del';
				x.textContent = '×';
				x.title = 'Delete this chat';
				x.onclick = function (ev) {
					ev.stopPropagation();
					if (confirm('Delete this chat?')) {
						api('conversations/' + c.id, { method: 'DELETE' }).then(loadChatList);
					}
				};
				b.appendChild(x);
				box.appendChild(b);
			});
		}).catch(function (e) { console.warn('sa chatlist', e); });
	}

	function openConv(id) {
		api('conversations/' + id).then(function (c) {
			state.convId = c.id;
			var msgs = c.messages || [];
			state.messages = msgs.slice(-20);
			$('sa-messages').innerHTML = '';
			msgs.forEach(function (m) {
				var div = document.createElement('div');
				div.className = 'sa-msg ' + (m.role === 'user' ? 'sa-user' : 'sa-assistant');
				var bubble = document.createElement('div');
				bubble.className = 'sa-bubble';
				bubble.innerHTML = m.role === 'user' ? esc(m.content).replace(/\n/g, '<br>') : renderMd(m.content);
				div.appendChild(bubble);
				$('sa-messages').appendChild(div);
			});
			chipRow();
			switchTab('chat');
		}).catch(function (e) { status('Could not open chat: ' + e.message, true); });
	}

	function loadSkills() {
		api('skills').then(function (r) {
			state.cards = r.cards || [];
			state.specialists = r.specialists || [];
			var box = $('sa-skill-cards');
			box.innerHTML = '';
			var groups = {};
			state.specialists.forEach(function (s) {
				(s.groups = s.groups || {});
				(groups[s.group] = groups[s.group] || []).push({ kind: 'sp', item: s });
			});
			state.cards.forEach(function (c) {
				(groups[c.group] = groups[c.group] || []).push({ kind: 'card', item: c });
			});
			Object.keys(groups).sort().forEach(function (g) {
				var h = document.createElement('h3');
				h.className = 'sa-group';
				h.textContent = g;
				box.appendChild(h);
				groups[g].forEach(function (e) {
					var it = e.item;
					var b = document.createElement('button');
					b.className = 'sa-card';
					b.innerHTML = '<div class="sa-card-t">' + esc(it.title) +
						(e.kind === 'card' && it.group === 'Paid' ? '<span class="sa-badge">Free here</span>' : '') + '</div>' +
						'<div class="sa-card-d">' + esc(it.desc) + '</div>';
					b.onclick = function () {
						if (e.kind === 'sp') { state.specialist = it.id; }
						else {
							state.skill = it.id;
							// card fills the composer with its starter prompt
							$('sa-input').value = it.prompt.indexOf('I give') >= 0 || /topic I give/i.test(it.prompt) ? '' : '→ ' + it.title;
						}
						chipRow();
						switchTab('chat');
						$('sa-input').focus();
					};
					box.appendChild(b);
				});
			});
		}).catch(function (e) {
			$('sa-skill-cards').innerHTML = '<em>Skills unavailable: ' + esc(e.message) + '</em>';
		});
	}

	function switchTab(name) {
		document.querySelectorAll('.sa-tab').forEach(function (t) {
			t.classList.toggle('active', t.dataset.tab === name);
		});
		document.querySelectorAll('.sa-panel').forEach(function (p) {
			p.classList.toggle('sa-hidden', p.id !== 'sa-panel-' + name);
		});
		if (name === 'chat') loadChatList();
		if (name === 'skills') loadSkills();
	}

	/* --- settings --- */
	function credRow(name, val, removable) {
		var tr = document.createElement('div');
		tr.className = 'sa-cred';
		tr.innerHTML = '<input type="text" class="sa-cred-name" value="' + esc(name) + '" placeholder="credential name" maxlength="60">' +
			'<input type="text" class="sa-cred-val" value="' + esc(val) + '" placeholder="value" maxlength="500" autocomplete="off">';
		if (removable !== false) {
			var x = document.createElement('button');
			x.type = 'button';
			x.className = 'button-link';
			x.textContent = '× remove';
			x.onclick = function () { tr.remove(); };
			tr.appendChild(x);
		}
		return tr;
	}
	(function initCreds() {
		var box = $('sa-creds');
		(sa_api.settings.extra_creds || []).forEach(function (c) {
			box.appendChild(credRow(c.name, '', true));
		});
		$('sa-add-cred').onclick = function () { box.appendChild(credRow('', '', true)); };
	})();

	$('sa-settings-form').addEventListener('submit', function (ev) {
		ev.preventDefault();
		var body = {
			base_url: $('sa-base-url').value,
			api_key: $('sa-api-key').value,
			model: $('sa-model').value,
			temperature: $('sa-temp').value,
			max_tokens: $('sa-maxtok').value,
			greeting_name: $('sa-greet').value,
			extra_creds: Array.prototype.map.call(document.querySelectorAll('#sa-creds .sa-cred'), function (d) {
				return { name: d.querySelector('.sa-cred-name').value, value: d.querySelector('.sa-cred-val').value };
			}).filter(function (c) { return c.name || c.value; })
		};
		api('settings', { method: 'POST', body: body }).then(function () {
			$('sa-settings-status').textContent = 'Saved.';
			$('sa-api-key').value = '';
			location.reload(); // refresh localized settings (has_key etc.)
		}).catch(function (e) {
			$('sa-settings-status').textContent = 'Save failed: ' + e.message;
		});
	});

	document.querySelectorAll('.sa-preset').forEach(function (b) {
		b.onclick = function () {
			$('sa-base-url').value = b.dataset.base;
			$('sa-model').value = b.dataset.model;
		};
	});

	$('sa-test-conn').onclick = function () {
		// save current form first (silently), then ping
		var body = {
			base_url: $('sa-base-url').value,
			api_key: $('sa-api-key').value,
			model: $('sa-model').value,
			temperature: $('sa-temp').value,
			max_tokens: Math.max(64, parseInt($('sa-maxtok').value, 10) || 512),
			greeting_name: $('sa-greet').value
		};
		api('settings', { method: 'POST', body: body }).then(function () {
			$('sa-settings-status').textContent = 'Testing…';
			return api('chat', { method: 'POST', body: {
				messages: [{ role: 'user', content: 'Connection test: reply with exactly: OK' }],
				save: false
			} });
		}).then(function (r) {
			$('sa-settings-status').textContent = r.ok ? ('Connected (' + (r.model || 'provider') + ').') : ('Failed: ' + r.error);
		}).catch(function (e) {
			$('sa-settings-status').textContent = 'Failed: ' + e.message;
		});
	};

	/* --- wiring --- */
	$('sa-composer').addEventListener('submit', function (ev) {
		ev.preventDefault();
		send($('sa-input').value);
	});
	$('sa-new-chat').onclick = newChat;
	document.querySelectorAll('.sa-tab').forEach(function (t) {
		t.onclick = function () { switchTab(t.dataset.tab); };
	});

	// deep link from the Settings submenu
	if (location.pathname.indexOf('sa-settings') >= 0) switchTab('settings');

	hero();
	loadChatList();
}());
