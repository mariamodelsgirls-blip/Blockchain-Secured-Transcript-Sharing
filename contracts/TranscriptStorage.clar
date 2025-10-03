(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-ALREADY-EXISTS (err u101))
(define-constant ERR-NOT-FOUND (err u102))
(define-constant ERR-INVALID-METADATA (err u103))
(define-constant ERR-INVALID-OWNER (err u104))
(define-constant ERR-INVALID-INSTITUTION (err u105))
(define-constant ERR-REVOKED-ALREADY (err u106))
(define-constant ERR-UPDATE-NOT-ALLOWED (err u107))
(define-constant ERR-INVALID-TIMESTAMP (err u108))
(define-constant ERR-MAX-TRANSCRIPTS-EXCEEDED (err u109))
(define-constant ERR-INVALID-DEGREE (err u110))
(define-constant ERR-INVALID-GPA (err u111))
(define-constant ERR-INVALID-COURSES (err u112))
(define-constant ERR-AUTHORITY-NOT-VERIFIED (err u113))

(define-data-var next-transcript-id uint u0)
(define-data-var max-transcripts uint u500)
(define-data-var storage-fee uint u500)
(define-data-var authority-contract (optional principal) none)

(define-map Transcripts
  { transcript-id: (buff 32) }
  {
    owner: principal,
    institution: principal,
    metadata: (string-utf8 200),
    degree: (string-utf8 50),
    gpa: uint,
    courses: (list 10 uint),
    issued-at: uint,
    revoked: bool,
    status: bool
  }
)

(define-map transcripts-by-owner
  principal
  (list 100 { transcript-id: (buff 32) })
)

(define-map transcript-updates
  { transcript-id: (buff 32) }
  {
    update-metadata: (string-utf8 200),
    update-gpa: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-transcript (transcript-id (buff 32)))
  (map-get? Transcripts { transcript-id: transcript-id })
)

(define-read-only (get-transcripts-by-owner (owner principal))
  (map-get? transcripts-by-owner owner)
)

(define-read-only (get-transcript-updates (transcript-id (buff 32)))
  (map-get? transcript-updates { transcript-id: transcript-id })
)

(define-read-only (is-transcript-revoked (transcript-id (buff 32)))
  (match (map-get? Transcripts { transcript-id: transcript-id })
    transcript { revoked: (get revoked transcript) }
    false
  )
)

(define-read-only (get-transcript-count)
  (ok (var-get next-transcript-id))
)

(define-private (validate-metadata (meta (string-utf8 200)))
  (if (and (> (len meta) u0) (<= (len meta) u200))
      (ok true)
      (err ERR-INVALID-METADATA))
)

(define-private (validate-owner (own principal))
  (if (not (is-eq own tx-sender))
      (ok true)
      (err ERR-INVALID-OWNER))
)

(define-private (validate-institution (inst principal))
  (if (is-eq inst tx-sender)
      (ok true)
      (err ERR-INVALID-INSTITUTION))
)

(define-private (validate-degree (deg (string-utf8 50)))
  (if (or (is-eq deg "Bachelor") (is-eq deg "Master") (is-eq deg "PhD"))
      (ok true)
      (err ERR-INVALID-DEGREE))
)

(define-private (validate-gpa (g uint))
  (if (and (>= g u0) (<= g u40))
      (ok true)
      (err ERR-INVALID-GPA))
)

(define-private (validate-courses (cs (list 10 uint)))
  (if (<= (len cs) u10)
      (ok true)
      (err ERR-INVALID-COURSES))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-transcripts (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX-TRANSCRIPTS-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-transcripts new-max)
    (ok true)
  )
)

(define-public (set-storage-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-METADATA))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set storage-fee new-fee)
    (ok true)
  )
)

(define-public (store-transcript (transcript-id (buff 32)) (owner principal) (metadata (string-utf8 200)) (degree (string-utf8 50)) (gpa uint) (courses (list 10 uint)))
  (let (
        (next-id (var-get next-transcript-id))
        (current-max (var-get max-transcripts))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-TRANSCRIPTS-EXCEEDED))
    (try! (validate-metadata metadata))
    (try! (validate-owner owner))
    (try! (validate-institution tx-sender))
    (try! (validate-degree degree))
    (try! (validate-gpa gpa))
    (try! (validate-courses courses))
    (asserts! (is-none (map-get? Transcripts { transcript-id: transcript-id })) (err ERR-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get storage-fee) tx-sender authority-recipient))
    )
    (map-set Transcripts { transcript-id: transcript-id }
      {
        owner: owner,
        institution: tx-sender,
        metadata: metadata,
        degree: degree,
        gpa: gpa,
        courses: courses,
        issued-at: block-height,
        revoked: false,
        status: true
      }
    )
    (let ((owner-list (default-to (list) (map-get? transcripts-by-owner owner))))
      (map-set transcripts-by-owner owner (as-max-len? (append owner-list { transcript-id: transcript-id }) u100))
    )
    (var-set next-transcript-id (+ next-id u1))
    (print { event: "transcript-stored", id: transcript-id })
    (ok true)
  )
)

(define-public (revoke-transcript (transcript-id (buff 32)))
  (let ((transcript (map-get? Transcripts { transcript-id: transcript-id })))
    (match transcript
      t
        (begin
          (asserts! (is-eq (get institution t) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (not (get revoked t)) (err ERR-REVOKED-ALREADY))
          (map-set Transcripts { transcript-id: transcript-id }
            {
              owner: (get owner t),
              institution: (get institution t),
              metadata: (get metadata t),
              degree: (get degree t),
              gpa: (get gpa t),
              courses: (get courses t),
              issued-at: (get issued-at t),
              revoked: true,
              status: false
            }
          )
          (print { event: "transcript-revoked", id: transcript-id })
          (ok true)
        )
      (err ERR-NOT-FOUND)
    )
  )
)

(define-public (update-transcript (transcript-id (buff 32)) (update-metadata (string-utf8 200)) (update-gpa uint))
  (let ((transcript (map-get? Transcripts { transcript-id: transcript-id })))
    (match transcript
      t
        (begin
          (asserts! (is-eq (get owner t) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (not (get revoked t)) (err ERR-UPDATE-NOT-ALLOWED))
          (try! (validate-metadata update-metadata))
          (try! (validate-gpa update-gpa))
          (map-set Transcripts { transcript-id: transcript-id }
            {
              owner: (get owner t),
              institution: (get institution t),
              metadata: update-metadata,
              degree: (get degree t),
              gpa: update-gpa,
              courses: (get courses t),
              issued-at: (get issued-at t),
              revoked: (get revoked t),
              status: (get status t)
            }
          )
          (map-set transcript-updates { transcript-id: transcript-id }
            {
              update-metadata: update-metadata,
              update-gpa: update-gpa,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "transcript-updated", id: transcript-id })
          (ok true)
        )
      (err ERR-NOT-FOUND)
    )
  )
)

(define-public (check-transcript-existence (transcript-id (buff 32)))
  (ok (is-some (map-get? Transcripts { transcript-id: transcript-id })))
)