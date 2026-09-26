import { api } from '../lib/api.js';
import { esc, num, icon, heading, skeleton, notice, errorView } from '../lib/ui.js';
const labels = { stars: 'Stars', forks: 'Forks', watchers: 'Watchers', openIssues: 'Open issues & PRs', size: 'Repository size (KB)', followers: 'Followers', following: 'Following', publicRepos: 'Public repositories', publicGists: 'Public gists', totalStars: 'Stars in analyzed repos', totalForks: 'Forks in analyzed repos', repoCount: 'Repositories analyzed' };
export function compare(ctx) {
  ctx.render(`${heading('A little perspective.', 'Put two projects or developers side by side. Discover what makes each one different.')}<div class="compare-cols mt-8">${[true, false].map(repo => `<form id="${repo ? 'repo' : 'dev'}Compare" class="card"><div class="row mb-3">${icon(repo ? 'repo' : 'users')}<h2>${repo ? 'Compare repositories' : 'Compare developers'}</h2></div><p class="mb-6 text-xs leading-6 text-neutral-500">${repo ? 'Understand the scale, community, and attention behind a project.' : 'Explore profiles, public work, and community reach.'}</p><div class="stack"><label>${repo ? 'First repository' : 'First developer'}<input name="a" placeholder="${repo ? 'facebook/react' : 'torvalds'}" required pattern="${repo ? '[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+' : '[A-Za-z0-9-]+'}" aria-label="${repo ? 'First repository' : 'First developer'}"></label><div class="text-center text-xs text-neutral-600">compared with</div><label>${repo ? 'Second repository' : 'Second developer'}<input name="b" placeholder="${repo ? 'vuejs/core' : 'gaearon'}" required pattern="${repo ? '[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+' : '[A-Za-z0-9-]+'}"></label><button class="btn btn-primary mt-2" type="submit">${icon('compare')} ${repo ? 'Compare repositories' : 'Compare developers'}</button></div></form>`).join('')}</div><div id="comparison" class="mt-8" aria-live="polite"></div>`);
  let sequence = 0;
  for (const repo of [true, false]) {
    const form = ctx.view.querySelector(repo ? '#repoCompare' : '#devCompare');
    form.onsubmit = async event => {
      event.preventDefault(); const id = ++sequence;
      const a = form.elements.a.value.trim(); const b = form.elements.b.value.trim();
      const button = form.querySelector('button'); button.disabled = true;
      const out = ctx.view.querySelector('#comparison'); out.innerHTML = skeleton(2);
      try {
        const query = new URLSearchParams(repo ? { repoA: a, repoB: b } : { userA: a, userB: b });
        const data = await api(`/api/compare/${repo ? 'repos' : 'devs'}?${query}`, { signal: ctx.signal });
        if (!ctx.active() || id !== sequence) return;
        out.innerHTML = `<div class="section-head"><h2>The comparison</h2><span class="pill">${repo ? 'Repository' : 'Developer'} insights</span></div>${data.sample ? notice(`Repository metrics use up to 100 recently updated repositories per developer. ${a}: ${data.sample.a.available ? `${data.sample.a.analyzed} of ${data.sample.a.total}` : 'unavailable'}; ${b}: ${data.sample.b.available ? `${data.sample.b.analyzed} of ${data.sample.b.total}` : 'unavailable'}.`) : ''}<div class="table-wrap"><table class="cmp"><caption class="sr-only">Comparison of ${esc(a)} and ${esc(b)}</caption><thead><tr><th scope="col">Metric</th><th scope="col">${esc(a)}</th><th scope="col">${esc(b)}</th></tr></thead><tbody>${data.comparison.map(c => `<tr><th scope="row">${esc(labels[c.metric] || c.metric)}</th><td>${num(c.a)}</td><td>${num(c.b)}</td></tr>`).join('')}</tbody></table></div><p class="mt-4 text-xs text-neutral-500">Numbers provide context. More isn’t always better — choose what matters to your project.</p>`;
      } catch (error) { if (error.name !== 'AbortError' && id === sequence && ctx.active()) { out.innerHTML = errorView(error); out.querySelector('[data-retry]').onclick = () => form.requestSubmit(); } }
      finally { button.disabled = false; }
    };
  }
}
