/**
 * Quote the current page selection into the composer of the visible conversation.
 * The quote reuses the composer's own quote node, so the sent message carries a
 * Markdown blockquote exactly like the selection button.
 *
 * Two input paths share one action: the configurable shortcut command, which
 * keeps the binding visible and rebindable in Settings, and a document key
 * listener for the same accepted binding. The listener covers an input that
 * never reaches the command registry because the native bridge or the modal /
 * region arbitration dropped it; a short cool-down keeps one press from
 * inserting twice.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-plugin-quote-shortcut',
  factory() {
    /** Locale namespace of this plugin; also the dictionary key namespace. */
    const NS = 'quoteShortcut'
    /** Command identity shared by the registry entry and the DOM fallback. */
    const COMMAND_ID = 'input.quoteSelection'
    /** Chinese copy, matching the shortest labels the shortcut list shows. */
    const zh = {
      'action.label': '将选中文字引用到输入框',
      'reason.noSelection': '先选中一段文字',
      'reason.noSession': '当前没有可输入的会话',
      'reason.busy': '输入框正在发送消息',
      'reason.failed': '没能把选中文字放进输入框',
    }
    /** English copy for the same action and refusals. */
    const en = {
      'action.label': 'Quote selection into the composer',
      'reason.noSelection': 'Select some text first',
      'reason.noSession': 'No writable conversation',
      'reason.busy': 'The composer is busy',
      'reason.failed': 'Could not quote the selection',
    }

    /**
     * @param view - document or frame window to read a selection from.
     * @param own - whether the composer's own draft counts as a quotable selection.
     * @returns the selected text, or null when nothing usable is selected there.
     */
    const selectionOf = (view, own) => {
      let selection
      try {
        selection = view.getSelection()
      } catch {
        return null
      }
      if (selection === null || selection === undefined || selection.isCollapsed) return null
      const text = selection.toString().replace(/\r\n?/gu, '\n').trim()
      if (text === '') return null
      if (!own) return text
      const anchor = selection.anchorNode
      const element = anchor === null
        ? null
        : anchor.nodeType === 1 ? anchor : anchor.parentElement
      // A selection inside the composer would quote the draft into itself.
      if (element !== null && typeof element.closest === 'function'
        && element.closest('[contenteditable="true"]') !== null) return null
      return text
    }

    /**
     * Read the page selection, including same-origin preview frames such as an
     * HTML document preview; the browser tab's guest webview stays out of reach.
     * @returns the selected text, or null when nothing usable is selected.
     */
    const readSelection = () => {
      const own = selectionOf(window, true)
      if (own !== null) return own
      for (const frame of document.querySelectorAll('iframe')) {
        const view = frame.contentWindow
        if (view === null) continue
        const text = selectionOf(view, false)
        if (text !== null) return text
      }
      return null
    }

    /**
     * @param event - key press to compare with one accepted binding.
     * @param binding - normalized binding, or null while the command is unbound.
     * @returns whether the press is exactly that combination.
     */
    const matches = (event, binding) => binding !== null && binding !== undefined
      && binding.secondCode === undefined
      && event.code === binding.code
      && event.metaKey === binding.modifiers.includes('meta')
      && event.ctrlKey === binding.modifiers.includes('control')
      && event.altKey === binding.modifiers.includes('alt')
      && event.shiftKey === binding.modifiers.includes('shift')

    return {
      inject: ['shortcuts', 'sessions', 'locale'],
      apply(ctx) {
        // A page-level marker keeps "did the module load at all" answerable from
        // DevTools without reading plugin state.
        window.__dshQuoteShortcut = 'ready'
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'quote-shortcut: dictionaries')
        const t = (() => {
          try {
            return ctx.locale.bind(NS)
          } catch {
            // A locale failure must not take the shortcut down with it.
            return key => key
          }
        })()
        /** Timestamp of the last insertion, shared by both input paths. */
        let lastFire = 0

        /** @returns the retained Session row the main view currently shows. */
        const currentSession = () => Object.values(ctx.sessions.list.getSnapshot().byId)
          .find(row => (row.retainedBy.mainView ?? 0) > 0)

        /**
         * @param sessionId - Session whose composer receives the quote.
         * @returns the composer facade, or undefined when the Session is not retained.
         */
        const inputOf = (sessionId) => {
          const scope = ctx.sessions.scope(sessionId)
          if (scope === undefined) return undefined
          try {
            const conversation = scope.get('conversation')
            return conversation === undefined ? undefined : conversation.input.for(scope)
          } catch {
            return undefined
          }
        }

        /**
         * @param text - selected text to insert as one quote.
         * @returns null on success, or the refusal copy.
         */
        const insert = (text) => {
          const session = currentSession()
          if (session === undefined) return t('reason.noSession')
          const input = inputOf(session.id)
          if (input === undefined) return t('reason.noSession')
          if (input.state.getSnapshot().phase !== 'plain') {
            input.notify('info', t('reason.busy'))
            return t('reason.busy')
          }
          if (input.insertQuote(text)) return null
          input.notify('error', t('reason.failed'))
          return t('reason.failed')
        }

        /**
         * Run the whole action once per press.
         * @returns whether the press was consumed by an insertion attempt.
         */
        const fire = () => {
          const now = Date.now()
          if (now - lastFire < 400) return true
          const text = readSelection()
          if (text === null) {
            window.__dshQuoteShortcutLast = { at: now, status: 'no-selection' }
            return false
          }
          lastFire = now
          const reason = insert(text)
          window.__dshQuoteShortcutLast = {
            at: now, status: reason === null ? 'handled' : 'blocked', reason: reason ?? undefined, chars: text.length,
          }
          return true
        }

        /** @returns the accepted binding of this command, falling back to ⌘L / Ctrl+L. */
        const bindingNow = () => {
          try {
            const entry = ctx.shortcuts.catalog.getSnapshot().find(candidate => candidate.id === COMMAND_ID)
            if (entry !== undefined) return entry.binding
          } catch {
            // The catalog is unavailable only before the service settles.
          }
          const mac = /mac|iphone|ipad/iu.test(navigator.platform ?? '')
          return { code: 'KeyL', modifiers: [mac ? 'meta' : 'control'] }
        }

        try {
          ctx.effect(() => ctx.shortcuts.register({
            id: COMMAND_ID,
            label: () => t('action.label'),
            aliases: ['quote selection', 'add selection to input', '引用选中文字', '选中文字到输入框'],
            defaults: {
              'desktop:macos': { code: 'KeyL', modifiers: ['primary'] },
              'desktop:windows': { code: 'KeyL', modifiers: ['primary'] },
              'desktop:linux': { code: 'KeyL', modifiers: ['primary'] },
              'web:macos': { code: 'KeyL', modifiers: ['primary', 'alt'] },
              'web:windows': { code: 'KeyL', modifiers: ['primary', 'alt'] },
              'web:linux': { code: 'KeyL', modifiers: ['primary', 'alt'] },
            },
            regions: ['page', 'editable'],
            modals: ['sidebar'],
            resolve(context) {
              // Terminals keep their own Ctrl+L; nothing else is worth
              // intercepting without a selection.
              if (context.region === 'terminal') return { status: 'pass' }
              if (readSelection() === null) return { status: 'pass' }
              return { status: 'handled', run: () => { fire() } }
            },
          }), 'quote-shortcut: command')
        } catch (error) {
          // Keep the direct key path usable when the registry rejects this row.
          window.__dshQuoteShortcutError = String(error && error.message ? error.message : error)
        }

        ctx.effect(() => {
          /**
           * @param event - document key press in the capture phase.
           * @returns nothing.
           */
          const onKeyDown = (event) => {
            if (event.defaultPrevented || event.isComposing || event.repeat) return
            if (!matches(event, bindingNow())) return
            const target = event.target
            const element = target instanceof Element ? target : null
            if (element !== null && element.closest('.xterm') !== null) return
            if (!fire()) return
            event.preventDefault()
            event.stopPropagation()
          }
          window.addEventListener('keydown', onKeyDown, true)
          return () => { window.removeEventListener('keydown', onKeyDown, true) }
        }, 'quote-shortcut: key listener')
      },
    }
  },
})
