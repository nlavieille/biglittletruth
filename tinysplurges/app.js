const region = document.querySelector('#region');
const search = document.querySelector('#search');
const filters = document.querySelector('#filters');
const grid = document.querySelector('#products');
const status = document.querySelector('#status');
let activeCategory = 'All';
let products = [];

try {
  const savedRegion = localStorage.getItem('tiny-region');
  if (savedRegion === 'US' || savedRegion === 'CA') region.value = savedRegion;
} catch {}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function regionalUrl(url) {
  try {
    if (new URL(url).protocol === 'https:') return url;
  } catch {}
  return '';
}

function regionalProducts() {
  return products.flatMap((product) => {
    if (product.active === false) return [];
    const variants = (product.variants ?? []).filter(
      (variant) => regionalUrl(variant.links?.[region.value]),
    );
    const url = regionalUrl(product.links?.[region.value]);
    return url || variants.length ? [{ product, url, variants }] : [];
  }).sort((a, b) => (a.product.displayOrder ?? Infinity) - (b.product.displayOrder ?? Infinity));
}

function renderFilters() {
  const categories = new Set(['All']);
  for (const { product } of regionalProducts()) {
    if (product.active === false) continue;
    for (const category of product.categories ?? []) categories.add(category);
  }
  if (!categories.has(activeCategory)) activeCategory = 'All';
  filters.replaceChildren();
  for (const category of categories) {
    const button = element('button', category);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(category === activeCategory));
    button.onclick = () => {
      activeCategory = category;
      for (const filter of filters.children) {
        filter.setAttribute('aria-pressed', String(filter === button));
      }
      renderProducts();
    };
    filters.append(button);
  }
}

function productCard({ product, url, variants }) {
  const card = element('article', null, 'product');
  if (product.id) card.dataset.productId = product.id;
  const amazon = product.merchant === 'Amazon';
  const media = element('div', null, 'product-media');
  card.append(media);
  function updateImage(variant) {
    const src = variant?.images?.[region.value] ?? product.images?.[region.value] ?? product.image;
    const placeholder = element('div', 'Product image coming soon', 'product-placeholder');
    media.replaceChildren(placeholder);
    if (!src) return;
    const image = element('img');
    image.alt = `${product.name}${variant ? ' — ' + variant.name : ''} (AI illustration)`;
    image.loading = 'lazy';
    image.addEventListener('error', () => { if (image.parentNode === media) media.replaceChildren(placeholder); });
    media.replaceChildren(image, element('p', 'AI illustration · See listing for exact product', 'image-note'));
    image.src = src;
  }
  updateImage(variants[0]);

  if (amazon) card.append(element('p', product.categories?.[0], 'product-category'));
  card.append(element('h3', product.name), element('p', product.description));

  const actions = element('div', null, 'product-actions');
  const link = element('a', amazon ? 'Shop on Amazon ↗' : 'Check price ↗', 'button');
  link.rel = 'sponsored noopener';
  link.target = '_blank';
  if (variants.length) {
    const label = element('label', 'Style', 'product-variant');
    const select = element('select');
    for (const variant of variants) {
      const option = element('option', variant.name);
      option.value = variant.id;
      select.append(option);
    }
    const updateLink = () => {
      const variant = variants[select.selectedIndex];
      link.setAttribute('href', variant.links[region.value]);
      updateImage(variant);
    };
    select.addEventListener('change', updateLink);
    updateLink();
    label.append(select);
    actions.append(label);
  } else {
    link.setAttribute('href', url);
  }
  if (amazon) actions.append(element('p', 'Check price on Amazon', 'product-price'));
  else if (product.merchant) card.append(element('p', product.merchant));
  actions.append(link);
  card.append(actions);
  return card;
}

function renderProducts() {
  const query = search.value.toLowerCase().trim();
  const results = regionalProducts().filter(({ product }) => (
    (activeCategory === 'All' || product.categories?.includes(activeCategory))
    && `${product.name} ${product.description ?? ''}`.toLowerCase().includes(query)
  ));
  status.textContent = results.length
    ? `${results.length} ${results.length === 1 ? 'find' : 'finds'}`
    : 'No finds match your selection.';
  grid.replaceChildren(...results.map(productCard));
}

region.addEventListener('change', () => {
  try {
    localStorage.setItem('tiny-region', region.value);
  } catch {}
  renderFilters();
  renderProducts();
});
search.addEventListener('input', renderProducts);
renderFilters();
status.textContent = 'Loading finds…';

fetch('products.json')
  .then((response) => {
    if (!response.ok) throw new Error('Could not load products');
    return response.json();
  })
  .then((catalogue) => {
    products = catalogue;
    renderFilters();
    renderProducts();
  })
  .catch(() => {
    status.textContent = 'Finds are temporarily unavailable. Please check back soon.';
  });