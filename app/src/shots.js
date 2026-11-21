// Set up local sample scenes and mark the shot ready after painting.
export async function runShot(shot, query, load) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const photo = query.get('photo') === 'boulevard' ? 'boulevard' : 'pier';
  await load({
    sample: `samples/${photo}.jpg`,
    alternate: `samples/${photo === 'pier' ? 'boulevard' : 'pier'}.jpg`,
    title: query.get('caption') ?? 'Sunset Heist',
    wide: query.get('size') === '1920x1080',
  });
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
