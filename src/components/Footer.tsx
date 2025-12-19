export default function Footer() {
  return (
    <footer
      className="bg-gray-900 text-white pt-4 pb-4 mt-0 font-normal border-t-0"
      style={{ fontFamily: 'var(--font-geist-sans, Arial, sans-serif)', borderTop: 'none' }}
    >
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

          

          {/* Links Rápidos */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Links Rápidos</h4>
            <ul className="space-y-2 text-gray-400">
              <li>
                <a href="/" className="hover:text-white transition-colors">
                  Início
                </a>
              </li>
              <li>
                <a href="/categorias" className="hover:text-white transition-colors">
                  Produtos
                </a>
              </li>
              <li>
                <a href="#contato" className="hover:text-white transition-colors">
                  Contato
                </a>
              </li>
            </ul>
          </div>

          {/* Contato */}
          <div id="contato">
            <h4 className="text-lg font-semibold mb-4">Contato</h4>
            <div className="space-y-3 text-gray-400">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Telefone:</span>
                <a
                  href="tel:+551133334444"
                  className="hover:text-white transition-colors"
                >
                  (11) 3333-4444
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">WhatsApp:</span>
                <a
                  href="https://wa.me/5511999998888"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  (11) 99999-8888
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">Email:</span>
                <a
                  href="mailto:contato@formwerk.com.br"
                  className="hover:text-white transition-colors"
                >
                  contato@formwerk.com.br
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <p className="text-center text-gray-400">
            &copy; 2025 FormWerk. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
