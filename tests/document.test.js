import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newDoc, useStore } from '../src/state/store.js'
import { parseDocument, readSceneFile, IMPORT_LIMITS } from '../src/state/persistence.js'
import { makeCustomDef } from '../src/catalog/items.js'

function fixture() {
  const doc = newDoc()
  doc.customItems.custom_box = makeCustomDef({ label: 'Box', w: 1, d: 1, h: 1, color: '#ffffff', lit: false })
  doc.items = [{ id: 'one', type: 'pixlip', w: 2, x: 0, z: 0, rotation: 0, color: null, graphics: { front: 'data:image/png;base64,YQ==' } },
    { id: 'two', type: 'custom_box', w: null, x: 1, z: 1, rotation: 90, color: null, graphics: {} }]
  return doc
}

test('stock and custom documents round trip with and without artwork', async () => {
  for (const art of [true, false]) {
    const doc = fixture()
    if (!art) doc.items.forEach((it) => { it.graphics = {} })
    assert.deepEqual(await readSceneFile(new File([JSON.stringify(doc)], 'test.exposcene')), doc)
  }
})

test('invalid imports leave document and undo history untouched', async () => {
  const mutations = [
    (d) => { d.stand.type = 'invalid' }, (d) => { d.stand = null },
    (d) => { d.project = [] }, (d) => { d.items = null },
    (d) => { d.items[1].id = 'one' }, (d) => { d.items[0].type = 'toString' },
    (d) => { d.items[0].x = Infinity }, (d) => { d.stand.width = 41 },
    (d) => { d.items[0].graphics.front = 3 }, (d) => { d.scene.hall = 'yes' },
    (d) => { d.items[0].w = 5 }, (d) => { d.customItems.custom_box.h = null },
    (d) => { d.project.notes = 'x'.repeat(10001) }, (d) => { d.version = 3 },
    (d) => { d.items[0].graphics.front = 'https://example.com/image.png' },
  ]
  useStore.getState().loadDoc(newDoc())
  useStore.getState().setProject({ client: 'Keep me' })
  const before = useStore.getState()
  for (const mutate of mutations) {
    const doc = fixture(); mutate(doc)
    assert.throws(() => parseDocument(doc), /Invalid ExpoPreview/)
    assert.equal(useStore.getState().doc, before.doc)
    assert.equal(useStore.getState().past, before.past)
  }
  await assert.rejects(readSceneFile(new File(['{'], 'broken.json')), /malformed JSON/)
  let read = false
  await assert.rejects(readSceneFile({ size: IMPORT_LIMITS.fileBytes + 1, text() { read = true } }), /64 MiB/)
  assert.equal(read, false)
})

test('missing optional fields get defaults; supplied null fields are invalid', () => {
  assert.deepEqual(parseDocument({ version: 2 }), newDoc())
  assert.throws(() => parseDocument({ version: 2, project: { name: null } }))
})

test('synthetic v1 migration rotates layout; invalid legacy values fail', () => {
  const legacy = { version: 1, scene: { standWidth: 6, standDepth: 4, placedItems: [{ type: 'counter', x: 1, z: 2, rotation: 0 }] } }
  const doc = parseDocument(legacy)
  assert.equal(doc.items[0].x, -1)
  assert.equal(doc.items[0].rotation, 180)
  legacy.scene.placedItems[0].x = 'bad'
  assert.throws(() => parseDocument(legacy))
})

test('first edit after replacement is undoable with the same merge key', () => {
  const s = useStore.getState()
  s.loadDoc(newDoc())
  s.setProject({ name: 'Old edit' })
  const loaded = fixture()
  s.loadDoc(loaded)
  s.setProject({ name: 'New edit' })
  s.undo()
  assert.equal(useStore.getState().doc, loaded)
  assert.equal(useStore.getState().recoveryDoc.project.name, 'Old edit')
})

test('replacement protects project-only edits and custom definitions; Cancel preserves history', async () => {
  const { isDirty, replaceDocument } = await import('../src/state/actions.js')
  const s = useStore.getState()
  s.loadDoc(newDoc())
  assert.equal(isDirty(), false)
  s.setProject({ notes: 'Unsaved notes on an empty stand' })
  assert.equal(isDirty(), true)
  const before = useStore.getState()
  const cancelled = replaceDocument(fixture())
  useStore.getState().replacement.resolve('cancel')
  assert.equal(await cancelled, false)
  assert.equal(useStore.getState().doc, before.doc)
  assert.equal(useStore.getState().past, before.past)
  const accepted = replaceDocument(fixture())
  useStore.getState().replacement.resolve('discard')
  assert.equal(await accepted, true)
  assert.equal(useStore.getState().recoveryDoc, before.doc)
  s.loadDoc(newDoc())
  s.addCustomItem(makeCustomDef({ label: 'Custom', w: 1, d: 1, h: 1, color: '#ffffff', lit: false }))
  assert.equal(isDirty(), true)
})

test('recovered documents remain dirty until backed up', async () => {
  const { isDirty, replaceDocument } = await import('../src/state/actions.js')
  useStore.getState().loadDoc(newDoc())
  assert.equal(await replaceDocument(fixture(), false), true)
  assert.equal(isDirty(), true)
  useStore.getState().markSaved(useStore.getState().doc)
  assert.equal(isDirty(), false)
})
