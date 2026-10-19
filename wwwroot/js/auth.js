/* Emma AI · Authentication page behavior (login / register) */
(() => {
    'use strict';

    /* ---------- Password visibility ---------- */
    document.querySelectorAll('[data-password-toggle]').forEach((button) => {
        button.addEventListener('click', () => {
            const input = document.getElementById(button.dataset.passwordToggle);
            if (!input) return;

            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            button.setAttribute('aria-pressed', String(show));
            button.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');

            // Keep the caret where the user left it.
            const end = input.value.length;
            input.focus({ preventScroll: true });
            try {
                input.setSelectionRange(end, end);
            } catch {
                /* Not all input types support selection ranges. */
            }
        });
    });

    /* ---------- Submit feedback ---------- */
    // Runs once the submit event has fully settled, so client-side validation
    // (jQuery unobtrusive) can still cancel the request first.
    document.querySelectorAll('form.auth-form').forEach((form) => {
        form.addEventListener('submit', (event) => {
            queueMicrotask(() => {
                if (event.defaultPrevented) return;

                const button = form.querySelector('.auth-submit');
                if (!button || button.disabled) return;

                const label = button.querySelector('.btn-label');
                const loadingLabel = button.dataset.loading;

                if (label) {
                    if (!button.dataset.originalLabel) button.dataset.originalLabel = label.textContent;
                    if (loadingLabel) label.textContent = loadingLabel;
                }

                button.classList.add('is-loading');
                button.disabled = true;
            });
        });
    });

    /* Restore the button if the page is resumed from the back/forward cache. */
    window.addEventListener('pageshow', (event) => {
        if (!event.persisted) return;

        document.querySelectorAll('.auth-submit.is-loading').forEach((button) => {
            button.disabled = false;
            button.classList.remove('is-loading');

            const label = button.querySelector('.btn-label');
            if (label && button.dataset.originalLabel) {
                label.textContent = button.dataset.originalLabel;
            }
        });
    });
})();
