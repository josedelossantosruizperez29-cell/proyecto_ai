document.getElementById('settingsLanguage')?.addEventListener('change', () => {
    showToast('Los idiomas estarán disponibles pronto.', 'success');
});

document.querySelectorAll('.settings-segment').forEach(element => {
    element.addEventListener('click', () => {
        document.querySelectorAll('.settings-segment').forEach(segment => segment.classList.remove('active'));
        element.classList.add('active');
        showToast('Los temas estarán disponibles pronto.', 'success');
    });
});
