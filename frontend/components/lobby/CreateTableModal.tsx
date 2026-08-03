'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface CreateTableModalProps {
  open: boolean
  onClose: () => void
  chipBalance: number
  onCreate: (params: {
    name: string
    maxPlayers: number
    smallBlind: number
    bigBlind: number
    minBuyin: number
    maxBuyin: number
    buyIn: number
  }) => void
}

const playerOptions = [2, 3, 4, 5, 6]
const blindOptions = [10, 20, 50, 100, 200, 500]

function choiceClass(active: boolean) {
  return `casino-create-choice ${active ? 'is-selected' : ''}`
}

export function CreateTableModal({ open, onClose, chipBalance, onCreate }: CreateTableModalProps) {
  const [name, setName] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(6)
  const [bigBlind, setBigBlind] = useState(50)
  const [buyIn, setBuyIn] = useState(1000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const smallBlind = bigBlind / 2
  const minBuyin = bigBlind * 20
  const maxBuyin = bigBlind * 100
  const actualBuyIn = Math.max(minBuyin, Math.min(maxBuyin, buyIn))
  const canAfford = chipBalance >= actualBuyIn
  const tableName = name.trim() || 'My Table'

  const updateBigBlind = (value: number) => {
    setBigBlind(value)
    setBuyIn((current) => Math.max(value * 20, Math.min(value * 100, current)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canAfford) return
    setLoading(true)
    setError('')
    try {
      await onCreate({
        name: name || 'My Table',
        maxPlayers,
        smallBlind,
        bigBlind,
        minBuyin,
        maxBuyin,
        buyIn: actualBuyIn,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create table')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start Poker Table"
      maxWidth="max-w-3xl"
      panelClassName="casino-create-modal casino-create-modal--poker"
      headerClassName="casino-create-modal__header"
      titleClassName="casino-create-modal__title"
      closeClassName="casino-create-modal__close"
      bodyClassName="casino-create-modal__body"
    >
      <form onSubmit={handleSubmit} className="casino-create-form">
        <section className="casino-create-form__main" aria-label="Poker table setup">
          <div className="casino-create-field">
            <label className="casino-create-label" htmlFor="poker-table-name">Table name</label>
            <input
              id="poker-table-name"
              className="casino-create-input"
              placeholder="My Table"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
          </div>

          <div className="casino-create-form__split">
            <fieldset className="casino-create-field">
              <legend className="casino-create-label">Seats</legend>
              <div className="casino-create-choice-grid casino-create-choice-grid--players">
                {playerOptions.map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={choiceClass(maxPlayers === count)}
                    aria-pressed={maxPlayers === count}
                    onClick={() => setMaxPlayers(count)}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="casino-create-field">
              <legend className="casino-create-label">Big blind</legend>
              <div className="casino-create-choice-grid casino-create-choice-grid--stakes">
                {blindOptions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={choiceClass(bigBlind === value)}
                    aria-pressed={bigBlind === value}
                    onClick={() => updateBigBlind(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="casino-create-field">
            <div className="casino-create-label-row">
              <label className="casino-create-label" htmlFor="poker-buy-in">Buy-in</label>
              <span>{minBuyin.toLocaleString()}-{maxBuyin.toLocaleString()}</span>
            </div>
            <input
              id="poker-buy-in"
              type="number"
              className="casino-create-input"
              value={buyIn}
              onChange={(e) => setBuyIn(Number(e.target.value))}
              min={minBuyin}
              max={maxBuyin}
            />
            <div className="casino-create-quick-actions">
              <button type="button" onClick={() => setBuyIn(minBuyin)}>20 BB</button>
              <button type="button" onClick={() => setBuyIn(bigBlind * 50)}>50 BB</button>
              <button type="button" onClick={() => setBuyIn(maxBuyin)}>Max</button>
            </div>
          </div>
        </section>

        <aside className="casino-create-summary" aria-label="Poker table summary">
          <div className="casino-create-summary__top">
            <span className="casino-create-summary__mark" aria-hidden="true">&#9824;</span>
            <div>
              <div className="casino-create-summary__eyebrow">Texas Holdem</div>
              <strong>{tableName}</strong>
            </div>
          </div>

          <div className="casino-create-summary__stats">
            <div>
              <span>Seats</span>
              <strong>{maxPlayers}</strong>
            </div>
            <div>
              <span>Blinds</span>
              <strong>{smallBlind}/{bigBlind}</strong>
            </div>
            <div>
              <span>Stack</span>
              <strong>{actualBuyIn.toLocaleString()}</strong>
            </div>
            <div>
              <span>Balance</span>
              <strong>{chipBalance.toLocaleString()}</strong>
            </div>
          </div>

          <p className={`casino-create-status ${canAfford ? '' : 'is-danger'}`}>
            {canAfford
              ? 'You will sit as the first player after the table opens.'
              : `Insufficient chips. Balance: ${chipBalance.toLocaleString()}`}
          </p>

          {error && <p className="casino-create-error">{error}</p>}

          <div className="casino-create-actions">
            <Button type="button" variant="ghost" className="casino-create-actions__secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" className="casino-create-actions__primary" loading={loading} disabled={!canAfford}>
              Create & Sit
            </Button>
          </div>
        </aside>
      </form>
    </Modal>
  )
}
