// ==UserScript==
// @name         PaperCut Web Cashier bulk deposit helper
// @namespace    local.papercut.bulk-deposit
// @version      2.2.0
// @description  Submit CSV deposits through an already logged-in PaperCut Web Cashier session.
// @match        http://10.52.5.20:9191/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var STORAGE_KEY = 'papercut.bulkDeposit.queue.v1';
  var DEPOSIT_URL = '/app?service=page/WebCashierDeposit';

  function stateGet() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (error) { return null; }
  }
  function stateSet(value) { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
  function stateClear() { localStorage.removeItem(STORAGE_KEY); }
  function textOf(element) { return (element.textContent || element.innerText || '').replace(/^\s+|\s+$/g, ''); }
  function later(fn, milliseconds) { window.setTimeout(fn, milliseconds); }

  function parseCsv(text) {
    var lines = text.replace(/^\uFEFF/, '').split(/\r?\n/), rows = [], header, i, cells, username, amount, comment;
    for (i = lines.length - 1; i >= 0; i -= 1) if (!textOf({ textContent: lines[i] })) lines.splice(i, 1);
    if (lines.length < 2) throw new Error('Use a header row plus at least one deposit row.');
    header = lines[0].split(',');
    if (textOf({ textContent: header[0] }).toLowerCase() !== 'username' || textOf({ textContent: header[1] }).toLowerCase() !== 'amount') {
      throw new Error('The first two headers must be: username,amount');
    }
    for (i = 1; i < lines.length; i += 1) {
      cells = lines[i].split(',');
      username = textOf({ textContent: cells[0] || '' });
      amount = Number(String(cells[1] || '').replace(/[^0-9.-]/g, ''));
      comment = cells.slice(2).join(',').replace(/^\s+|\s+$/g, '');
      if (!username || !isFinite(amount) || amount <= 0) throw new Error('Invalid username or amount on line ' + (i + 1) + '.');
      rows.push({ username: username, amount: amount.toFixed(2), comment: comment });
    }
    return rows;
  }

  function fieldFor(labelName) {
    var labels = document.getElementsByTagName('label'), i, label, root, candidates;
    for (i = 0; i < labels.length; i += 1) {
      label = labels[i];
      if (textOf(label).toLowerCase() !== labelName.toLowerCase()) continue;
      if (label.htmlFor && document.getElementById(label.htmlFor)) return document.getElementById(label.htmlFor);
      root = label.parentNode;
      candidates = root ? root.querySelectorAll('input,textarea,select') : [];
      if (candidates.length) return candidates[0];
    }
    return null;
  }

  function visibleTextField(position) {
    var fields = document.querySelectorAll('input[type="text"],input:not([type]),textarea'), visible = [], i;
    for (i = 0; i < fields.length; i += 1) {
      if (fields[i].offsetParent !== null) visible.push(fields[i]);
    }
    return visible[position] || null;
  }

  function depositButton() {
    var buttons = document.querySelectorAll('button,input[type="submit"]'), i, value;
    for (i = 0; i < buttons.length; i += 1) {
      value = textOf(buttons[i]) || buttons[i].value || '';
      if (value.toLowerCase() === 'deposit' && buttons[i].offsetParent !== null) return buttons[i];
    }
    return null;
  }

  function setField(element, value) {
    var prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    var event;
    element.focus();
    // PaperCut's UI keeps its own field state, so use the native setter first.
    if (descriptor && descriptor.set) descriptor.set.call(element, value);
    else element.value = value;
    event = document.createEvent('HTMLEvents'); event.initEvent('input', true, false); element.dispatchEvent(event);
    event = document.createEvent('HTMLEvents'); event.initEvent('change', true, false); element.dispatchEvent(event);
    element.blur();
  }

  function addPanel() {
    var panel, file, preview, start, status, selectedRows = [];
    if (document.getElementById('papercut-bulk-panel')) return;
    panel = document.createElement('div');
    panel.id = 'papercut-bulk-panel';
    panel.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:99999;width:350px;padding:14px;background:#fff;color:#222;border:2px solid #4b873c;border-radius:8px;box-shadow:0 3px 14px #0005;font:14px Arial';
    panel.innerHTML = '<b>Bulk deposit helper</b><p>Select CSV: <code>username,amount,commend</code></p><input id="pc-file" type="file" accept=".txt,.csv"><pre id="pc-preview" style="max-height:100px;overflow:auto"></pre><button id="pc-start" disabled>Start deposits</button> <button id="pc-cancel">Cancel</button><p id="pc-status"></p>';
    document.body.appendChild(panel);
    file = document.getElementById('pc-file'); preview = document.getElementById('pc-preview');
    start = document.getElementById('pc-start'); status = document.getElementById('pc-status');
    file.addEventListener('change', function () {
      var reader = new FileReader();
      reader.onload = function () {
        var i, total = 0;
        try {
          selectedRows = parseCsv(String(reader.result));
          preview.textContent = '';
          for (i = 0; i < selectedRows.length; i += 1) { preview.textContent += selectedRows[i].username + '  +' + selectedRows[i].amount + '  ' + selectedRows[i].comment + '\n'; total += Number(selectedRows[i].amount); }
          status.textContent = selectedRows.length + ' rows; total ' + total.toFixed(2) + '. Review before starting.';
          start.disabled = false;
        } catch (error) { status.textContent = error.message; start.disabled = true; selectedRows = []; }
      };
      if (file.files.length) reader.readAsText(file.files[0]);
    });
    start.addEventListener('click', function () {
      var total = 0, i;
      for (i = 0; i < selectedRows.length; i += 1) total += Number(selectedRows[i].amount);
      if (!window.confirm('Submit ' + selectedRows.length + ' final cash deposits totaling ' + total.toFixed(2) + '?')) return;
      stateSet({ rows: selectedRows, index: 0, running: true, phase: 'ready', submittedIndex: null });
      submitCurrent();
    });
    document.getElementById('pc-cancel').addEventListener('click', function () { stateClear(); window.location.href = DEPOSIT_URL; });
  }

  function submitCurrent() {
    var state = stateGet(), row, username, amount, comment, payment, button, status;
    if (!state || !state.running || state.phase !== 'ready') return;
    row = state.rows[state.index];
    if (!row) {
      stateClear();
      window.alert('Bulk deposit complete: ' + state.index + ' of ' + state.rows.length + ' rows.');
      return;
    }
    status = document.getElementById('pc-status');
    if (status) status.textContent = 'Processing row ' + (state.index + 1) + ' of ' + state.rows.length + ': ' + row.username;
    // PaperCut themes sometimes render the labels without a usable HTML "for" link.
    // On this Deposit page, the first three visible text fields are username, amount, comment.
    username = fieldFor('Username') || visibleTextField(0);
    amount = fieldFor('Amount') || visibleTextField(1);
    comment = fieldFor('Comment') || visibleTextField(2);
    payment = fieldFor('Payment method'); button = depositButton();
    if (!username || !amount || !comment || !button) { state.running = false; state.error = 'Deposit form not found. No row submitted.'; stateSet(state); window.alert(state.error); return; }
    // PaperCut renders the Cash control as a custom dropdown, not always a <select>.
    // The cashier must visibly confirm Cash before starting the batch.
    if (payment && payment.tagName === 'SELECT' && textOf(payment.options[payment.selectedIndex]).toLowerCase() !== 'cash') { state.running = false; state.error = 'Select Cash, then restart.'; stateSet(state); window.alert(state.error); return; }
    setField(username, row.username);
    later(function () {
      var latest = stateGet();
      // The page can schedule submitCurrent more than once. Only the first
      // invocation for this exact row is allowed to click Deposit.
      if (!latest || !latest.running || latest.phase !== 'ready' || latest.index !== state.index) return;
      setField(amount, row.amount);
      setField(comment, row.comment);
      latest.phase = 'awaiting-receipt';
      latest.submittedIndex = latest.index;
      stateSet(latest);
      button.click();
    }, 1200);
  }

  function receipt() {
    var state = stateGet(), row;
    if (!state) return;
    // A receipt can be reloaded or revisited. Advance only when it corresponds
    // to a row that was marked awaiting-receipt immediately before Deposit.
    if (state.phase === 'awaiting-receipt' && state.submittedIndex === state.index) {
      row = state.rows[state.index];
      if (!row) { state.running = false; state.phase = 'stopped'; state.error = 'No queued row matches this receipt.'; stateSet(state); window.alert(state.error); return; }
      state.index += 1;
      state.phase = 'returning';
      state.submittedIndex = null;
      stateSet(state);
    } else if (state.phase !== 'returning') {
      // Never guess on an old or unrelated receipt; guessing can skip a row.
      return;
    }
    // Force a real page load. PaperCut's visible OK control can perform an
    // in-page transition that does not rerun userscripts, leaving the queue idle.
    later(function () { window.location.replace(DEPOSIT_URL); }, 2500);
  }

  if (window.location.search.indexOf('WebCashierDepositReceipt') >= 0) receipt();
  else if (window.location.search.indexOf('WebCashierDeposit') >= 0) {
    var activeState;
    addPanel();
    activeState = stateGet();
    if (activeState && activeState.running && activeState.phase === 'returning') {
      activeState.phase = 'ready';
      stateSet(activeState);
      // Allow PaperCut to finish returning from the acknowledgement page before filling row 2+.
      later(submitCurrent, 2000);
    } else if (activeState && activeState.running && activeState.phase === 'awaiting-receipt') {
      activeState.running = false;
      activeState.phase = 'stopped';
      activeState.error = 'Returned to Deposit without a receipt. Queue stopped to prevent a duplicate.';
      stateSet(activeState);
      window.alert(activeState.error);
    }
  }
}());
