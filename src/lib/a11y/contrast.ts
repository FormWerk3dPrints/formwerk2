/** Chave no localStorage e evento interno usados pelo alto contraste. */
export const CONTRAST_STORAGE_KEY = 'formwerk:contrast';
export const CONTRAST_CHANGE_EVENT = 'formwerk:contrast-change';

/**
 * Roda no <head>, antes da primeira pintura. Sem isso, quem deixou o alto
 * contraste ligado veria a página clara piscar a cada carregamento.
 *
 * Sem escolha salva, segue a preferência do sistema operacional
 * (prefers-contrast: more).
 */
export const CONTRAST_INIT_SCRIPT = `(function(){try{var v=localStorage.getItem('${CONTRAST_STORAGE_KEY}');var on=v==='high'||(v===null&&window.matchMedia&&window.matchMedia('(prefers-contrast: more)').matches);if(on){document.documentElement.setAttribute('data-contrast','high');}}catch(e){}})();`;
