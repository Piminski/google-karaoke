import {
  getBingImageCandidates,
  getWikipediaThumbnail,
  isLikelyProperNoun,
} from '../server/imageSearch.ts'

async function main() {
  const words = ['Sanctions', 'Los Angeles', 'Montreal', 'Alan Greenspan']
  for (const w of words) {
    console.log(`\n=== ${w} ===`)
    console.log('  properNoun:', isLikelyProperNoun(w))
    const wiki = await getWikipediaThumbnail(w)
    console.log('  wiki:', wiki?.slice(0, 90) ?? '(none)')
    const c = await getBingImageCandidates(w, {})
    for (const u of c.slice(0, 4)) console.log(' ', u.slice(0, 100))
  }
}

main()
