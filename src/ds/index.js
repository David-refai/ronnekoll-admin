'use client';
/* RönneKoll design system components — ported from the RönneKoll Admin design system bundle. */
/* eslint-disable */
import * as React from 'react';

  // React is read at call time, so the bundle may load before React does.
  function h() { return React.createElement.apply(null, arguments); }
  function F(p) { return React.createElement(React.Fragment, null, p.children); }
  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(' ');
  }
  function omit(o, keys) {
    var r = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k) && keys.indexOf(k) < 0) r[k] = o[k];
    return r;
  }

  /* ---------- Icon (Material Symbols Rounded) ---------- */
  function Icon(p) {
    var size = p.size || 20;
    return h('span', {
      className: cx('rk-icon', p.className), 'aria-hidden': p.label ? undefined : true, 'aria-label': p.label, role: p.label ? 'img' : undefined,
      style: Object.assign({ fontSize: size + 'px', width: size + 'px', height: size + 'px', fontVariationSettings: "'FILL' " + (p.fill ? 1 : 0) + ", 'wght' 400, 'opsz' " + Math.min(48, Math.max(20, size)) }, p.style)
    }, p.name);
  }

  /* ---------- Actions ---------- */
  function Button(p) {
    var variant = p.variant || 'filled';
    var rest = omit(p, ['variant', 'icon', 'trailingIcon', 'size', 'className', 'children']);
    return h('button', Object.assign({ type: 'button' }, rest, {
      className: cx('rk-btn', 'rk-btn--' + variant, p.size === 'sm' && 'rk-btn--sm', p.icon && 'rk-btn--has-icon', p.className)
    }), p.icon && h(Icon, { name: p.icon, size: 18 }), h('span', null, p.children), p.trailingIcon && h(Icon, { name: p.trailingIcon, size: 18 }));
  }
  function IconButton(p) {
    var rest = omit(p, ['icon', 'label', 'variant', 'badge', 'className', 'fill']);
    return h('button', Object.assign({ type: 'button', 'aria-label': p.label, title: p.label }, rest, {
      className: cx('rk-iconbtn', 'rk-iconbtn--' + (p.variant || 'standard'), p.className)
    }), h(Icon, { name: p.icon, size: 22, fill: p.fill }), p.badge ? h('span', { className: 'rk-iconbtn__badge' }, p.badge > 99 ? '99+' : p.badge) : null);
  }
  function Fab(p) {
    var rest = omit(p, ['icon', 'label', 'className']);
    return h('button', Object.assign({ type: 'button', 'aria-label': p.label }, rest, {
      className: cx('rk-fab', p.label && 'rk-fab--extended', p.className)
    }), h(Icon, { name: p.icon || 'barcode_scanner', size: 24 }), p.label && h('span', null, p.label));
  }
  function SegmentedButton(p) {
    return h('div', { className: 'rk-seg', role: 'radiogroup', 'aria-label': p.label },
      (p.options || []).map(function (o) {
        var on = o.value === p.value;
        return h('button', {
          key: o.value, type: 'button', role: 'radio', 'aria-checked': on, className: cx('rk-seg__btn', on && 'is-on'),
          onClick: function () { p.onChange && p.onChange(o.value); }
        }, on ? h(Icon, { name: 'check', size: 18 }) : (o.icon && h(Icon, { name: o.icon, size: 18 })), o.label);
      }));
  }

  /* ---------- Inputs ---------- */
  function Chip(p) {
    var variant = p.variant || 'filter';
    var on = !!p.selected;
    return h('span', { className: cx('rk-chip', 'rk-chip--' + variant, on && 'is-on', p.className) },
      h('button', { type: 'button', className: 'rk-chip__main', 'aria-pressed': variant === 'filter' ? on : undefined, onClick: p.onClick },
        variant === 'filter' && on ? h(Icon, { name: 'check', size: 18 }) : (p.icon && h(Icon, { name: p.icon, size: 18 })),
        h('span', null, p.label),
        p.count != null && h('span', { className: 'rk-chip__count' }, p.count),
        p.dropdown && h(Icon, { name: 'arrow_drop_down', size: 18 })),
      p.onRemove && h('button', { type: 'button', className: 'rk-chip__remove', 'aria-label': 'Ta bort ' + p.label, onClick: p.onRemove }, h(Icon, { name: 'close', size: 16 })));
  }
  function FilterBar(p) {
    return h('div', { className: 'rk-filterbar' },
      h('div', { className: 'rk-filterbar__chips' }, p.children),
      p.onClear && h(Button, { variant: 'text', size: 'sm', onClick: p.onClear }, p.clearLabel || 'Rensa filter'),
      p.trailing && h('div', { className: 'rk-filterbar__trailing' }, p.trailing));
  }
  function SearchBar(p) {
    var rest = omit(p, ['placeholder', 'shortcut', 'onSubmit', 'className', 'scanning', 'size']);
    return h('form', { className: cx('rk-search', p.size === 'lg' && 'rk-search--lg', p.scanning && 'is-scanning', p.className), role: 'search',
      onSubmit: function (e) { e.preventDefault(); p.onSubmit && p.onSubmit(e.target.elements[0].value); } },
      h(Icon, { name: 'search', size: 22, className: 'rk-search__lead' }),
      h('input', Object.assign({ className: 'rk-search__input', placeholder: p.placeholder || 'Skanna eller sök serienummer, elev, e-post, klass…', 'aria-label': 'Sök eller skanna', autoComplete: 'off' }, rest)),
      p.shortcut !== false && h('kbd', { className: 'rk-kbd' }, p.shortcut || 'Ctrl K'),
      h('button', { type: 'submit', className: 'rk-search__go', 'aria-label': 'Sök' }, h(Icon, { name: p.scanning ? 'barcode_scanner' : 'arrow_forward', size: 20 })));
  }
  function TextField(p) {
    var id = p.id || ('tf-' + (p.label || '').replace(/\W+/g, '').toLowerCase());
    var rest = omit(p, ['label', 'helper', 'error', 'mono', 'leadingIcon', 'trailing', 'className', 'multiline', 'id']);
    var Tag = p.multiline ? 'textarea' : 'input';
    return h('div', { className: cx('rk-field', p.error && 'is-error', p.mono && 'rk-field--mono', p.className) },
      p.label && h('label', { className: 'rk-field__label', htmlFor: id }, p.label),
      h('div', { className: 'rk-field__box' },
        p.leadingIcon && h(Icon, { name: p.leadingIcon, size: 20 }),
        h(Tag, Object.assign({ id: id, className: 'rk-field__input', 'aria-invalid': !!p.error }, rest)),
        p.trailing),
      (p.error || p.helper) && h('div', { className: 'rk-field__help' }, p.error ? h(Icon, { name: 'error', size: 16, fill: true }) : null, p.error || p.helper));
  }
  function Switch(p) {
    return h('label', { className: cx('rk-switch', p.checked && 'is-on') },
      h('input', { type: 'checkbox', role: 'switch', checked: !!p.checked, onChange: function (e) { p.onChange && p.onChange(e.target.checked); } }),
      h('span', { className: 'rk-switch__track' }, h('span', { className: 'rk-switch__thumb' }, p.checked ? h(Icon, { name: 'check', size: 16 }) : null)),
      p.label && h('span', { className: 'rk-switch__label' }, p.label));
  }
  function YesNo(p) {
    return h('div', { className: cx('rk-yesno', p.danger && p.value === true && 'is-danger') },
      h('span', { className: 'rk-yesno__label' }, p.label),
      h(SegmentedButton, { label: p.label, value: p.value === true ? 'ja' : p.value === false ? 'nej' : null, onChange: function (v) { p.onChange && p.onChange(v === 'ja'); },
        options: [{ value: 'ja', label: 'Ja' }, { value: 'nej', label: 'Nej' }] }));
  }
  function Checkbox(p) {
    var ref = React.useRef(null);
    React.useEffect(function () { if (ref.current) ref.current.indeterminate = !!p.indeterminate; });
    return h('label', { className: cx('rk-check', (p.checked || p.indeterminate) && 'is-on') },
      h('input', { ref: ref, type: 'checkbox', checked: !!p.checked, 'aria-label': p.label && !p.showLabel ? p.label : undefined, onChange: function (e) { p.onChange && p.onChange(e.target.checked); } }),
      h('span', { className: 'rk-check__box' }, p.indeterminate ? h(Icon, { name: 'remove', size: 16 }) : p.checked ? h(Icon, { name: 'check', size: 16 }) : null),
      p.label && p.showLabel && h('span', null, p.label));
  }

  /* ---------- Status ---------- */
  var STATUS = {
    // Enhetsstatus
    'Tillgänglig': ['green', 'check_circle'], 'Tilldelad': ['blue', 'person'], 'Utlånad – tillfälligt': ['violet', 'schedule'],
    'Trasig': ['red', 'broken_image'], 'Under reparation': ['amber', 'build'], 'Kasserad': ['gray', 'delete'], 'Saknas': ['crimson', 'help'],
    // Ärendestatus
    'Ny': ['blue', 'fiber_new'], 'Pågår': ['violet', 'pending'], 'Pågående': ['violet', 'pending'], 'Väntar på del/leverantör': ['amber', 'hourglass_top'],
    'Skickad på reparation': ['orange', 'local_shipping'], 'Klar': ['green', 'check_circle'], 'Avvisad': ['gray', 'block'],
    // Lösenord / lån
    'Behandlas': ['violet', 'pending'], 'Klart': ['green', 'check_circle'],
    'Aktiv': ['violet', 'schedule'], 'Återlämnad': ['green', 'assignment_return'], 'Försenad': ['red', 'alarm'],
    // Prioritet
    'Låg': ['gray', 'keyboard_double_arrow_down'], 'Normal': ['blue', 'drag_handle'], 'Hög': ['amber', 'keyboard_double_arrow_up'], 'Akut': ['red', 'priority_high'],
    // Signatur
    'Signerad': ['green', 'draw'], 'Väntar signatur': ['amber', 'draw']
  };
  function Badge(p) {
    return h('span', { className: cx('rk-badge', 'rk-badge--' + (p.tone || 'gray'), p.size === 'lg' && 'rk-badge--lg', p.className) },
      p.icon && h(Icon, { name: p.icon, size: p.size === 'lg' ? 18 : 14, fill: true }), p.children);
  }
  function StatusBadge(p) {
    var s = STATUS[p.status] || ['gray', 'circle'];
    return h(Badge, { tone: s[0], icon: p.noIcon ? null : s[1], size: p.size, className: p.className }, p.label || (p.status === 'Kasserad' ? 'Kasserad' : p.status));
  }
  function TokenStatus(p) {
    var st = p.state || 'valid';
    var map = { valid: ['green', 'verified_user', 'Token giltig'], expiring: ['amber', 'timer', 'Går ut om ' + (p.minutes != null ? p.minutes : 10) + ' min'], expired: ['red', 'gpp_bad', 'Token utgången'] };
    var m = map[st];
    return h('button', { type: 'button', className: cx('rk-tokenpill', 'rk-badge--' + m[0]), onClick: p.onClick, title: 'Inställningar → Token' },
      h(Icon, { name: m[1], size: 18, fill: true }), h('span', null, st === 'valid' && p.minutes != null ? 'Giltig · ' + p.minutes + ' min' : m[2]));
  }
  function Banner(p) {
    var tone = p.tone || 'info';
    var icon = p.icon || { error: 'gpp_bad', warning: 'warning', info: 'info', success: 'check_circle' }[tone];
    return h('div', { className: cx('rk-banner', 'rk-banner--' + tone), role: tone === 'error' ? 'alert' : 'status' },
      h(Icon, { name: icon, size: 24, fill: true }),
      h('div', { className: 'rk-banner__text' }, p.title && h('div', { className: 'rk-banner__title' }, p.title), p.children && h('div', { className: 'rk-banner__body' }, p.children)),
      p.action && h('div', { className: 'rk-banner__action' }, p.action));
  }

  /* ---------- Shell ---------- */
  function Avatar(p) {
    var initials = (p.name || '?').split(/\s+/).map(function (s) { return s[0]; }).slice(0, 2).join('').toUpperCase();
    return h('span', { className: cx('rk-avatar', p.size === 'lg' && 'rk-avatar--lg'), title: p.name, 'aria-label': p.name }, initials);
  }
  var DEFAULT_NAV = [
    { label: 'Översikt', items: [{ id: 'oversikt', label: 'Översikt', icon: 'space_dashboard' }, { id: 'analys', label: 'Analys', icon: 'monitoring' }] },
    { label: 'Enheter', items: [{ id: 'enheter', label: 'Enheter', icon: 'laptop_chromebook' }, { id: 'importera', label: 'Importera', icon: 'upload_file' }, { id: 'inventering', label: 'Inventering', icon: 'inventory' }, { id: 'etiketter', label: 'Etiketter', icon: 'label' }] },
    { label: 'Elever & utdelning', items: [{ id: 'elever', label: 'Elever', icon: 'school' }, { id: 'tilldelning', label: 'Tilldelning', icon: 'assignment_ind' }, { id: 'aterlamning', label: 'Återlämning', icon: 'assignment_return' }, { id: 'utlaning', label: 'Tillfällig utlåning', icon: 'schedule' }] },
    { label: 'Ärenden', items: [{ id: 'felanmalningar', label: 'Felanmälningar', icon: 'report', count: 7 }, { id: 'skolarenden', label: 'Skolärenden', icon: 'handyman', count: 3 }, { id: 'losenord', label: 'Lösenordsbegäran', icon: 'password', count: 2 }] },
    { label: 'Rapporter', items: [{ id: 'rapporter', label: 'Rapporter', icon: 'summarize' }, { id: 'logg', label: 'Aktivitetslogg', icon: 'history' }] },
    { label: 'System', items: [{ id: 'personal', label: 'Personal & behörigheter', icon: 'badge' }, { id: 'datakvalitet', label: 'Datakvalitet', icon: 'rule' }, { id: 'installningar', label: 'Inställningar', icon: 'settings' }] }
  ];
  function NavDrawer(p) {
    var groups = p.groups || DEFAULT_NAV;
    return h('nav', { className: cx('rk-nav', p.collapsed && 'is-collapsed'), 'aria-label': 'Huvudmeny' },
      h('div', { className: 'rk-nav__brand' },
        h('span', { className: 'rk-nav__mark', 'aria-hidden': true }, 'R'),
        !p.collapsed && h('span', { className: 'rk-nav__name' }, 'RönneKoll', h('small', null, 'Admin')),
        p.onToggle && h(IconButton, { icon: p.collapsed ? 'menu' : 'menu_open', label: p.collapsed ? 'Visa meny' : 'Fäll ihop meny', onClick: p.onToggle, className: 'rk-nav__toggle' })),
      groups.map(function (g) {
        return h('div', { key: g.label, className: 'rk-nav__group' },
          !p.collapsed && h('div', { className: 'rk-nav__label' }, g.label),
          g.items.map(function (it) {
            var on = it.id === p.active;
            return h('a', { key: it.id, href: '#' + it.id, className: cx('rk-nav__item', on && 'is-on'), 'aria-current': on ? 'page' : undefined, title: p.collapsed ? it.label : undefined,
              onClick: function (e) { if (p.onSelect) { e.preventDefault(); p.onSelect(it.id); } } },
              h('span', { className: 'rk-nav__pill' }, h(Icon, { name: it.icon, size: 22, fill: on }), it.count && p.collapsed ? h('span', { className: 'rk-nav__dot' }) : null),
              !p.collapsed && h('span', { className: 'rk-nav__text' }, it.label),
              !p.collapsed && it.count ? h('span', { className: 'rk-nav__count' }, it.count) : null);
          }));
      }));
  }
  function TopBar(p) {
    return h('header', { className: 'rk-topbar' },
      p.leading,
      h('div', { className: 'rk-topbar__search' }, p.search || h(SearchBar, null)),
      h('div', { className: 'rk-topbar__actions' },
        h(TokenStatus, { state: p.tokenState || 'valid', minutes: p.tokenMinutes }),
        h(IconButton, { icon: 'notifications', label: 'Aviseringar', badge: p.notifications }),
        h(IconButton, { icon: p.dark ? 'light_mode' : 'dark_mode', label: 'Byt tema', onClick: p.onToggleTheme }),
        h(Avatar, { name: p.user || 'David IT-admin' })));
  }
  function PageHeader(p) {
    return h('div', { className: 'rk-pagehead' },
      h('div', { className: 'rk-pagehead__text' },
        p.overline && h('div', { className: 'rk-pagehead__over' }, p.overline),
        h('h1', { className: 'rk-pagehead__title' }, p.title),
        p.description && h('p', { className: 'rk-pagehead__desc' }, p.description)),
      p.actions && h('div', { className: 'rk-pagehead__actions' }, p.actions));
  }
  function AppShell(p) {
    return h('div', { className: cx('rk-shell', p.collapsed && 'is-collapsed') },
      p.nav || h(NavDrawer, { active: p.active, collapsed: p.collapsed }),
      h('div', { className: 'rk-shell__main' },
        p.topbar || h(TopBar, null),
        p.banner,
        h('main', { className: 'rk-shell__content' }, p.children)),
      p.fab && h('div', { className: 'rk-shell__fab' }, p.fab));
  }
  function Tabs(p) {
    return h('div', { className: 'rk-tabs', role: 'tablist' }, (p.tabs || []).map(function (t) {
      var id = t.id || t.label; var on = id === p.value;
      return h('button', { key: id, type: 'button', role: 'tab', 'aria-selected': on, className: cx('rk-tab', on && 'is-on'), onClick: function () { p.onChange && p.onChange(id); } },
        t.icon && h(Icon, { name: t.icon, size: 18, fill: on }), t.label, t.count != null && h('span', { className: 'rk-tab__count' }, t.count));
    }));
  }

  /* ---------- Cards & data display ---------- */
  function Card(p) {
    var rest = omit(p, ['interactive', 'padding', 'className', 'children', 'as']);
    return h(p.as || 'div', Object.assign({}, rest, { className: cx('rk-card', p.interactive && 'rk-card--interactive', p.padding === 'sm' && 'rk-card--sm', p.padding === 'none' && 'rk-card--flush', p.className) }), p.children);
  }
  function KpiCard(p) {
    return h(Card, { interactive: !!p.onClick, onClick: p.onClick, className: 'rk-kpi' },
      h('div', { className: 'rk-kpi__top' },
        h('span', { className: cx('rk-kpi__icon', 'rk-tone--' + (p.tone || 'primary')) }, h(Icon, { name: p.icon || 'laptop_chromebook', size: 22, fill: true })),
        p.delta && h('span', { className: cx('rk-kpi__delta', p.deltaTone && 'rk-text--' + p.deltaTone) }, p.delta)),
      h('div', { className: 'rk-kpi__value' }, p.value),
      h('div', { className: 'rk-kpi__label' }, p.label));
  }
  function AttentionCard(p) {
    return h(Card, { interactive: true, padding: 'sm', className: 'rk-attn', onClick: p.onClick },
      h('span', { className: cx('rk-attn__count', 'rk-badge--' + (p.tone || 'amber')) }, p.count),
      h('div', { className: 'rk-attn__text' }, h('div', { className: 'rk-attn__title' }, p.title), p.description && h('div', { className: 'rk-attn__desc' }, p.description)),
      h(Icon, { name: 'chevron_right', size: 22, className: 'rk-attn__go' }));
  }
  var MODEL_ICON = { Chromebook: 'laptop_chromebook', PC: 'laptop_windows', iPad: 'tablet_mac' };
  function DeviceCard(p) {
    var d = p.device || {};
    return h(Card, { interactive: true, className: 'rk-devcard', onClick: p.onClick },
      h('div', { className: 'rk-devcard__media' },
        h(Icon, { name: MODEL_ICON[d.produkt] || 'laptop_chromebook', size: 48 }),
        h(StatusBadge, { status: d.status, className: 'rk-devcard__status' })),
      h('div', { className: 'rk-devcard__body' },
        h('div', { className: 'rk-devcard__model' }, d.modell),
        h('div', { className: 'rk-devcard__ids' }, h('span', { className: 'rk-mono' }, d.serienummer), d.assetId && h('span', { className: 'rk-mono rk-muted' }, d.assetId)),
        h('div', { className: 'rk-devcard__holder' },
          d.elev ? h(F, null, h(Avatar, { name: d.elev }), h('span', null, h('b', null, d.elev), h('span', { className: 'rk-muted' }, '\u00a0· ' + d.klass))) :
            h('span', { className: 'rk-muted' }, h(Icon, { name: 'inventory_2', size: 18 }), ' Ledig · ' + (d.plats || 'IT-förråd')))));
  }
  function StudentCard(p) {
    var s = p.student || {};
    return h(Card, { interactive: true, className: 'rk-stucard', onClick: p.onClick },
      h('div', { className: 'rk-stucard__head' }, h(Avatar, { name: s.namn, size: 'lg' }),
        h('div', null, h('div', { className: 'rk-stucard__name' }, s.namn), h('div', { className: 'rk-muted rk-small' }, s.epost))),
      h('div', { className: 'rk-stucard__chips' },
        h(Badge, { tone: 'gray', icon: 'groups' }, s.klass),
        s.skap && h(Badge, { tone: 'gray', icon: 'lock' }, 'Skåp ' + s.skap),
        s.tagg && h(Badge, { tone: 'gray', icon: 'nfc' }, 'Tagg')),
      h('div', { className: 'rk-stucard__device' },
        s.enhet ? h(F, null, h(Icon, { name: 'laptop_chromebook', size: 20 }), h('span', { className: 'rk-mono' }, s.enhet), h(StatusBadge, { status: 'Tilldelad', noIcon: true })) :
          h(F, null, h(Icon, { name: 'block', size: 20 }), h('span', { className: 'rk-muted' }, 'Ingen enhet'))),
      s.lan ? h('div', { className: 'rk-small rk-text--violet' }, h(Icon, { name: 'schedule', size: 16 }), ' ' + s.lan + ' aktivt lån') : null);
  }
  function BulkBar(p) {
    if (!p.count) return null;
    return h('div', { className: 'rk-bulkbar', role: 'toolbar', 'aria-label': 'Massåtgärder' },
      h(IconButton, { icon: 'close', label: 'Avmarkera', onClick: p.onClear, className: 'rk-bulkbar__close' }),
      h('span', { className: 'rk-bulkbar__count' }, p.count + ' markerade'),
      h('div', { className: 'rk-bulkbar__actions' }, (p.actions || []).map(function (a) {
        return h(Button, { key: a.label, variant: a.danger ? 'danger-text' : 'text-inverse', size: 'sm', icon: a.icon, onClick: a.onClick }, a.label);
      })));
  }
  function DataTable(p) {
    var cols = p.columns || [], rows = p.rows || [];
    var sel = p.selected || [];
    var keyOf = function (r, i) { return r.id != null ? r.id : i; };
    var all = rows.length > 0 && sel.length === rows.length;
    var some = sel.length > 0 && !all;
    function toggle(k) { if (!p.onSelectionChange) return; p.onSelectionChange(sel.indexOf(k) >= 0 ? sel.filter(function (x) { return x !== k; }) : sel.concat([k])); }
    return h('div', { className: cx('rk-table', 'rk-table--' + (p.density || 'comfortable')) },
      p.toolbar && h('div', { className: 'rk-table__toolbar' }, p.toolbar),
      h('div', { className: 'rk-table__scroll', style: p.maxHeight ? { maxHeight: p.maxHeight } : null },
        h('table', null,
          h('thead', null, h('tr', null,
            p.selectable && h('th', { className: 'rk-table__sel' }, h(Checkbox, { label: 'Markera alla', checked: all, indeterminate: some, onChange: function () { p.onSelectionChange && p.onSelectionChange(all ? [] : rows.map(keyOf)); } })),
            cols.map(function (c) {
              var sorted = p.sort && p.sort.key === c.key;
              return h('th', { key: c.key, style: { width: c.width, textAlign: c.align, cursor: p.onSort && c.sortable !== false ? 'pointer' : undefined }, onClick: p.onSort && c.sortable !== false ? function () { p.onSort(c.key); } : undefined, 'aria-sort': sorted ? (p.sort.dir === 'asc' ? 'ascending' : 'descending') : undefined },
                h('span', { className: 'rk-th' }, c.label, sorted && h(Icon, { name: p.sort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward', size: 16 })));
            }))),
          h('tbody', null, rows.map(function (r, i) {
            var k = keyOf(r, i); var on = sel.indexOf(k) >= 0;
            return h('tr', { key: k, className: on ? 'is-selected' : undefined, onClick: p.onRowClick ? function () { p.onRowClick(r); } : undefined },
              p.selectable && h('td', { className: 'rk-table__sel', onClick: function (e) { e.stopPropagation(); } }, h(Checkbox, { label: 'Markera rad', checked: on, onChange: function () { toggle(k); } })),
              cols.map(function (c) {
                return h('td', { key: c.key, className: c.mono ? 'rk-mono' : undefined, style: { textAlign: c.align } }, c.render ? c.render(r) : r[c.key]);
              }));
          })))),
      p.footer && h('div', { className: 'rk-table__footer' }, p.footer),
      h(BulkBar, { count: sel.length, actions: p.bulkActions, onClear: function () { p.onSelectionChange && p.onSelectionChange([]); } }));
  }
  var EVENT_ICON = { tilldelning: ['assignment_ind', 'blue'], aterlamning: ['assignment_return', 'green'], utlaning: ['schedule', 'violet'], status: ['swap_horiz', 'amber'], felanmalan: ['report', 'red'], inventering: ['inventory', 'gray'], import: ['upload_file', 'gray'], kontrakt: ['draw', 'green'], etikett: ['label', 'gray'] };
  function Timeline(p) {
    return h('ol', { className: 'rk-timeline' }, (p.events || []).map(function (e, i) {
      var m = EVENT_ICON[e.type] || ['radio_button_checked', 'gray'];
      return h('li', { key: i, className: 'rk-timeline__item' },
        h('span', { className: cx('rk-timeline__dot', 'rk-badge--' + m[1]) }, h(Icon, { name: m[0], size: 18, fill: true })),
        h('div', { className: 'rk-timeline__body' },
          h('div', { className: 'rk-timeline__title' }, e.title),
          (e.before || e.after) && h('div', { className: 'rk-timeline__diff' }, e.before && h(StatusBadge, { status: e.before, noIcon: true }), h(Icon, { name: 'arrow_forward', size: 16 }), e.after && h(StatusBadge, { status: e.after, noIcon: true })),
          h('div', { className: 'rk-timeline__meta' }, e.time, e.user && ' · ' + e.user)));
    }));
  }
  function FaultCard(p) {
    var f = p.fault || {};
    return h(Card, { interactive: true, padding: 'sm', className: 'rk-fault', onClick: p.onClick },
      h('div', { className: 'rk-fault__top' }, h(StatusBadge, { status: f.prioritet }), h('span', { className: 'rk-muted rk-small' }, f.datum)),
      h('div', { className: 'rk-fault__main' },
        h('div', { style: { minWidth: 0 } },
          h('div', { className: 'rk-fault__type' }, f.typ),
          h('div', { className: 'rk-fault__desc' }, f.beskrivning)),
        f.bild && h('span', { className: 'rk-fault__thumb', style: f.bild === true ? null : { backgroundImage: 'url(' + f.bild + ')' }, 'aria-label': 'Bild bifogad' }, f.bild === true ? h(Icon, { name: 'image', size: 22 }) : null)),
      h('div', { className: 'rk-fault__foot' },
        f.plats ? h('span', { className: 'rk-small', style: { fontWeight: 600 } }, f.plats) : h('span', { className: 'rk-mono rk-small' }, f.enhet),
        f.elev && h('span', { className: 'rk-small rk-muted' }, f.klass ? f.elev + ' · ' + f.klass : f.elev)));
  }
  function KanbanBoard(p) {
    return h('div', { className: 'rk-kanban' }, (p.columns || []).map(function (c) {
      return h('section', { key: c.status, className: 'rk-kanban__col' },
        h('header', { className: 'rk-kanban__head' }, h(StatusBadge, { status: c.status }), h('span', { className: 'rk-kanban__n' }, (c.items || []).length)),
        h('div', { className: 'rk-kanban__list' }, (c.items || []).map(function (it, i) { return p.renderCard ? p.renderCard(it, i) : h(FaultCard, { key: i, fault: it }); })));
    }));
  }
  function Donut(p) {
    var data = p.data || [], total = data.reduce(function (s, d) { return s + d.value; }, 0) || 1;
    var r = 52, C = 2 * Math.PI * r, off = 0, size = p.size || 160;
    return h('div', { className: 'rk-donut' },
      h('svg', { viewBox: '0 0 140 140', width: size, height: size, role: 'img', 'aria-label': p.label || 'Fördelning' },
        h('circle', { cx: 70, cy: 70, r: r, className: 'rk-donut__track' }),
        data.map(function (d, i) {
          var len = d.value / total * C; var gap = data.length > 1 ? 3 : 0;
          var el = h('circle', { key: i, cx: 70, cy: 70, r: r, className: 'rk-donut__seg rk-stroke--' + d.tone, strokeDasharray: Math.max(0, len - gap) + ' ' + (C - Math.max(0, len - gap)), strokeDashoffset: -off, transform: 'rotate(-90 70 70)' });
          off += len; return el;
        }),
        h('text', { x: 70, y: 68, className: 'rk-donut__total' }, p.centerValue != null ? p.centerValue : total),
        h('text', { x: 70, y: 88, className: 'rk-donut__caption' }, p.centerLabel || 'enheter')),
      h('ul', { className: 'rk-legend' }, data.map(function (d, i) {
        return h('li', { key: i }, h('span', { className: 'rk-legend__sw rk-bg--' + d.tone }), h('span', { className: 'rk-legend__label' }, d.label), h('b', null, d.value));
      })));
  }
  function ChartCard(p) {
    return h(Card, { className: 'rk-chartcard' },
      h('div', { className: 'rk-chartcard__head' }, h('div', null, h('div', { className: 'rk-chartcard__title' }, p.title), p.subtitle && h('div', { className: 'rk-muted rk-small' }, p.subtitle)), p.action),
      h('div', { className: 'rk-chartcard__body' }, p.children));
  }

  /* ---------- Surfaces ---------- */
  function Dialog(p) {
    var tone = p.tone || 'default';
    var box = h('div', { className: cx('rk-dialog', 'rk-dialog--' + tone), role: 'dialog', 'aria-modal': p.inline ? undefined : true, 'aria-labelledby': 'rk-dlg-t' },
      p.icon && h('span', { className: 'rk-dialog__icon' }, h(Icon, { name: p.icon, size: 28 })),
      h('h2', { id: 'rk-dlg-t', className: 'rk-dialog__title' }, p.title),
      p.children && h('div', { className: 'rk-dialog__body' }, p.children),
      p.actions && h('div', { className: 'rk-dialog__actions' }, p.actions));
    if (p.inline) return h('div', { className: 'rk-scrim rk-scrim--inline' }, box);
    if (!p.open) return null;
    return h('div', { className: 'rk-scrim', onClick: function (e) { if (e.target === e.currentTarget && p.onClose) p.onClose(); } }, box);
  }
  function DecisionOption(p) {
    return h('button', { type: 'button', className: cx('rk-decision', p.selected && 'is-on'), onClick: p.onClick },
      h('span', { className: 'rk-decision__icon' }, h(Icon, { name: p.icon, size: 22 })),
      h('span', { className: 'rk-decision__text' }, h('b', null, p.title), h('span', null, p.description)),
      h(Icon, { name: 'chevron_right', size: 20 }));
  }
  Dialog.Option = DecisionOption;
  function SideSheet(p) {
    var sheet = h('aside', { className: cx('rk-sidesheet', p.wide && 'rk-sidesheet--wide'), role: 'dialog', 'aria-label': typeof p.title === 'string' ? p.title : undefined },
      h('header', { className: 'rk-sidesheet__head' },
        h('div', { className: 'rk-sidesheet__titles' }, p.overline && h('div', { className: 'rk-sidesheet__over' }, p.overline), h('h2', null, p.title), p.subtitle),
        h(IconButton, { icon: 'close', label: 'Stäng', onClick: p.onClose })),
      h('div', { className: 'rk-sidesheet__body' }, p.children),
      p.actions && h('footer', { className: 'rk-sidesheet__foot' }, p.actions));
    if (p.inline) return sheet;
    if (!p.open) return null;
    return h('div', { className: 'rk-scrim rk-scrim--side', onClick: function (e) { if (e.target === e.currentTarget && p.onClose) p.onClose(); } }, sheet);
  }
  function BottomSheet(p) {
    var sheet = h('div', { className: 'rk-bottomsheet', role: 'dialog' },
      h('span', { className: 'rk-bottomsheet__handle', 'aria-hidden': true }),
      p.title && h('h2', { className: 'rk-bottomsheet__title' }, p.title),
      h('div', { className: 'rk-bottomsheet__body' }, p.children));
    if (p.inline) return h('div', { className: 'rk-scrim rk-scrim--bottom rk-scrim--inline' }, sheet);
    if (!p.open) return null;
    return h('div', { className: 'rk-scrim rk-scrim--bottom', onClick: function (e) { if (e.target === e.currentTarget && p.onClose) p.onClose(); } }, sheet);
  }
  function Snackbar(p) {
    return h('div', { className: 'rk-snackbar', role: 'status' },
      p.icon && h(Icon, { name: p.icon, size: 20 }),
      h('span', { className: 'rk-snackbar__msg' }, p.message),
      p.actionLabel !== false && h('button', { type: 'button', className: 'rk-snackbar__action', onClick: p.onAction }, p.actionLabel || 'Ångra'),
      p.onClose && h('button', { type: 'button', className: 'rk-snackbar__close', 'aria-label': 'Stäng', onClick: p.onClose }, h(Icon, { name: 'close', size: 18 })));
  }
  function CommandPalette(p) {
    var idx = 0;
    return h('div', { className: 'rk-cmd', role: 'dialog', 'aria-label': 'Kommandopalett' },
      h('div', { className: 'rk-cmd__input' }, h(Icon, { name: 'search', size: 22 }),
        h('input', { value: p.query || '', placeholder: 'Sök enhet, elev eller skriv ett kommando…', onChange: function (e) { p.onQuery && p.onQuery(e.target.value); }, 'aria-label': 'Sök' }),
        h('kbd', { className: 'rk-kbd' }, 'Esc')),
      h('div', { className: 'rk-cmd__list', role: 'listbox' }, (p.groups || []).map(function (g) {
        return h('div', { key: g.label, className: 'rk-cmd__group' },
          h('div', { className: 'rk-cmd__label' }, g.label),
          g.items.map(function (it) {
            var i = idx++; var on = i === (p.activeIndex || 0);
            return h('div', { key: it.label, role: 'option', 'aria-selected': on, className: cx('rk-cmd__item', on && 'is-on') },
              h('span', { className: 'rk-cmd__ic' }, h(Icon, { name: it.icon, size: 20 })),
              h('span', { className: 'rk-cmd__text' }, h('span', null, it.label), it.hint && h('small', null, it.hint)),
              it.badge && h(StatusBadge, { status: it.badge, noIcon: true }),
              it.shortcut && h('kbd', { className: 'rk-kbd' }, it.shortcut),
              on && h(Icon, { name: 'keyboard_return', size: 18, className: 'rk-muted' }));
          }));
      })),
      h('div', { className: 'rk-cmd__foot' }, h('span', null, h('kbd', { className: 'rk-kbd' }, '↑↓'), ' navigera'), h('span', null, h('kbd', { className: 'rk-kbd' }, '↵'), ' öppna'), h('span', null, h('kbd', { className: 'rk-kbd' }, 'Ctrl K'), ' stäng')));
  }
  function Stepper(p) {
    var cur = p.current || 0;
    return h('ol', { className: cx('rk-stepper', p.vertical && 'rk-stepper--vertical') }, (p.steps || []).map(function (s, i) {
      var st = i < cur ? 'done' : i === cur ? 'current' : 'todo';
      var label = typeof s === 'string' ? s : s.label; var err = typeof s === 'object' && s.error;
      return h('li', { key: i, className: cx('rk-step', 'is-' + st, err && 'is-error'), 'aria-current': st === 'current' ? 'step' : undefined },
        h('span', { className: 'rk-step__dot' }, err ? h(Icon, { name: 'priority_high', size: 16 }) : st === 'done' ? h(Icon, { name: 'check', size: 16 }) : i + 1),
        h('span', { className: 'rk-step__label' }, label, typeof s === 'object' && s.hint && h('small', null, s.hint)));
    }));
  }

  /* ---------- Scanning ---------- */
  var SCAN = { idle: ['gray', 'barcode_scanner', 'Redo att skanna'], success: ['green', 'check_circle', 'Hittad'], warning: ['amber', 'wrong_location', 'Fel plats'], error: ['red', 'error', 'Okänd enhet'] };
  function ScanFeedback(p) {
    var st = p.state || 'idle'; var m = SCAN[st];
    return h('div', { className: cx('rk-scanfb', 'rk-scanfb--' + st), role: 'status', 'aria-live': 'assertive' },
      h('span', { className: 'rk-scanfb__icon' }, h(Icon, { name: m[1], size: 44, fill: true })),
      h('div', { className: 'rk-scanfb__text' },
        h('div', { className: 'rk-scanfb__title' }, p.title || m[2]),
        p.serial && h('div', { className: 'rk-scanfb__serial' }, p.serial),
        p.detail && h('div', { className: 'rk-scanfb__detail' }, p.detail)),
      p.action && h('div', { className: 'rk-scanfb__action' }, p.action));
  }
  function ScanCounters(p) {
    return h('div', { className: 'rk-counters' }, (p.items || []).map(function (c) {
      return h('div', { key: c.label, className: cx('rk-counter', 'rk-counter--' + (c.tone || 'gray')) },
        h('div', { className: 'rk-counter__value' }, c.value, c.total != null && h('small', null, ' / ' + c.total)),
        h('div', { className: 'rk-counter__label' }, c.icon && h(Icon, { name: c.icon, size: 16, fill: true }), c.label));
    }));
  }

  /* ---------- Documents ---------- */
  function SignaturePad(p) {
    var ref = React.useRef(null);
    var st = React.useState(!!p.signed); var has = st[0], setHas = st[1];
    React.useEffect(function () {
      var cv = ref.current; if (!cv) return;
      var ctx = cv.getContext('2d'); var dpr = window.devicePixelRatio || 1;
      var w = cv.clientWidth, hh = cv.clientHeight; cv.width = w * dpr; cv.height = hh * dpr; ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = getComputedStyle(cv).color;
      if (p.signed) { // demo signature
        ctx.beginPath(); var x0 = w * 0.18, y0 = hh * 0.62; ctx.moveTo(x0, y0);
        for (var t = 0; t <= 1.0001; t += 0.02) { var x = x0 + t * w * 0.6; var y = y0 - Math.sin(t * 9) * hh * 0.16 * (1 - t * 0.4) - t * hh * 0.08; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      var down = false;
      function pos(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
      function d(e) { down = true; var q = pos(e); ctx.beginPath(); ctx.moveTo(q[0], q[1]); cv.setPointerCapture(e.pointerId); }
      function m(e) { if (!down) return; var q = pos(e); ctx.lineTo(q[0], q[1]); ctx.stroke(); setHas(true); }
      function u() { down = false; }
      cv.addEventListener('pointerdown', d); cv.addEventListener('pointermove', m); cv.addEventListener('pointerup', u);
      return function () { cv.removeEventListener('pointerdown', d); cv.removeEventListener('pointermove', m); cv.removeEventListener('pointerup', u); };
    }, [p.signed]);
    function clear() { var cv = ref.current; cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); setHas(false); p.onClear && p.onClear(); }
    return h('div', { className: 'rk-sigpad' },
      h('div', { className: 'rk-sigpad__head' }, h('span', { className: 'rk-sigpad__label' }, p.label || 'Signatur'), h(Button, { variant: 'text', size: 'sm', icon: 'ink_eraser', onClick: clear, disabled: !has }, 'Rensa')),
      h('div', { className: 'rk-sigpad__area' },
        h('canvas', { ref: ref, className: 'rk-sigpad__canvas', 'aria-label': 'Signera här' }),
        !has && h('span', { className: 'rk-sigpad__hint' }, 'Signera här med mus, penna eller finger'),
        h('span', { className: 'rk-sigpad__line' }, h(Icon, { name: 'close', size: 16 }))),
      h('div', { className: 'rk-sigpad__foot' }, p.signer && h('span', null, 'Signatur av ', h('b', null, p.signer)), p.date && h('span', { className: 'rk-muted' }, p.date)));
  }
  function PdfPreview(p) {
    return h('div', { className: 'rk-pdf' },
      h('div', { className: 'rk-pdf__bar' }, h(Icon, { name: 'picture_as_pdf', size: 20, fill: true }), h('span', { className: 'rk-pdf__name' }, p.fileName || 'Kontrakt.pdf'), h('span', { className: 'rk-muted rk-small' }, (p.page || 1) + ' / ' + (p.pages || 1)),
        h('span', { className: 'rk-pdf__tools' }, h(IconButton, { icon: 'zoom_out', label: 'Zooma ut' }), h(IconButton, { icon: 'zoom_in', label: 'Zooma in' }), h(IconButton, { icon: 'download', label: 'Ladda ner' }))),
      h('div', { className: 'rk-pdf__stage' }, h('div', { className: 'rk-pdf__page' }, p.children)));
  }
  function bars(serial) {
    // visual stand-in for Code128 — production renders with JsBarcode
    var out = [], x = 0, s = 'x' + (serial || '') + 'x';
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); for (var j = 0; j < 3; j++) { var w = 1 + ((c >> (j * 2)) & 3) % 3; out.push([x, w]); x += w + 1 + ((c >> j) & 1); } }
    return { bars: out, width: x };
  }
  function qr(seed) {
    var n = 21, cells = [], v = 0;
    for (var i = 0; i < (seed || '').length; i++) v = (v * 31 + seed.charCodeAt(i)) >>> 0;
    function finder(x, y) { return (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7); }
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      if (finder(x, y)) { var fx = x < 7 ? x : x - (n - 7), fy = y < 7 ? y : y - (n - 7); var ring = Math.max(Math.abs(fx - 3), Math.abs(fy - 3)); if (ring !== 2) cells.push([x, y]); continue; }
      v = (v * 1103515245 + 12345) >>> 0; if ((v >> 16) & 1) cells.push([x, y]);
    }
    return cells;
  }
  function LabelPreview(p) {
    var d = p.device || {}; var f = Object.assign({ qr: true, barcode: true, assetId: true, modell: true, skola: true, elev: false }, p.fields);
    var tpl = p.template || '62x29';
    var b = bars(d.serienummer);
    return h('div', { className: cx('rk-label', 'rk-label--' + tpl) },
      f.qr && h('svg', { className: 'rk-label__qr', viewBox: '0 0 21 21', 'aria-label': 'QR-kod' }, qr(d.serienummer).map(function (c, i) { return h('rect', { key: i, x: c[0], y: c[1], width: 1.02, height: 1.02 }); })),
      h('div', { className: 'rk-label__text' },
        f.skola && h('div', { className: 'rk-label__school' }, 'Rönnenskolan – Malmö stad'),
        f.assetId && h('div', { className: 'rk-label__asset' }, d.assetId),
        f.modell && h('div', { className: 'rk-label__model' }, d.modell),
        f.elev && d.elev && h('div', { className: 'rk-label__model' }, d.elev + ' · ' + d.klass),
        f.barcode && h('svg', { className: 'rk-label__barcode', viewBox: '0 0 ' + b.width + ' 20', preserveAspectRatio: 'none', 'aria-label': 'Streckkod' }, b.bars.map(function (q, i) { return h('rect', { key: i, x: q[0], y: 0, width: q[1], height: 20 }); })),
        f.barcode && h('div', { className: 'rk-label__serial' }, d.serienummer)));
  }

  /* ---------- Feedback ---------- */
  function EmptyState(p) {
    return h('div', { className: cx('rk-empty', p.compact && 'rk-empty--compact') },
      h('span', { className: cx('rk-empty__art', p.tone && 'rk-badge--' + p.tone) }, h(Icon, { name: p.icon || 'inbox', size: 40 })),
      h('h3', { className: 'rk-empty__title' }, p.title),
      p.description && h('p', { className: 'rk-empty__desc' }, p.description),
      p.action && h('div', { className: 'rk-empty__action' }, p.action));
  }
  function Skeleton(p) {
    var v = p.variant || 'text';
    if (v === 'text' && p.lines > 1) {
      var arr = []; for (var i = 0; i < p.lines; i++) arr.push(h('span', { key: i, className: 'rk-skel rk-skel--text', style: { width: i === p.lines - 1 ? '60%' : '100%' } }));
      return h('span', { className: 'rk-skel-lines' }, arr);
    }
    return h('span', { className: cx('rk-skel', 'rk-skel--' + v), 'aria-hidden': true, style: { width: p.width, height: p.height } });
  }


export { Icon, Button, IconButton, Fab, SegmentedButton, Chip, FilterBar, SearchBar, TextField, Switch, YesNo, Checkbox, StatusBadge, Badge, TokenStatus, Banner, Avatar, NavDrawer, TopBar, PageHeader, AppShell, Tabs, Card, KpiCard, AttentionCard, DeviceCard, StudentCard, DataTable, BulkBar, Timeline, KanbanBoard, FaultCard, ChartCard, Donut, Dialog, SideSheet, BottomSheet, Snackbar, CommandPalette, Stepper, ScanFeedback, ScanCounters, SignaturePad, PdfPreview, LabelPreview, EmptyState, Skeleton, STATUS, DEFAULT_NAV as NAV };
