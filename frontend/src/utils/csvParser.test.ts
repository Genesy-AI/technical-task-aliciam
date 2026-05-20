import { describe, it, expect } from 'vitest'
import { parseCsv, isValidEmail, isValidCountryCode, normalizeCountryCode } from './csvParser'

describe('isValidEmail', () => {
  it('should return true for valid email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
    expect(isValidEmail('first.last+tag@example.org')).toBe(true)
    expect(isValidEmail('123@456.com')).toBe(true)
  })

  it('should return false for invalid email addresses', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('invalid')).toBe(false)
    expect(isValidEmail('test@')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('test.example.com')).toBe(false)
    expect(isValidEmail('test@.com')).toBe(false)
    expect(isValidEmail('test@example')).toBe(false)
  })
})

describe('parseCsv', () => {
  it('should throw error for empty content', () => {
    expect(() => parseCsv('')).toThrow('CSV content cannot be empty')
    expect(() => parseCsv('   ')).toThrow('CSV content cannot be empty')
  })

  it('should throw error for CSV with only headers', () => {
    const csv = 'firstName,lastName,email'
    expect(() => parseCsv(csv)).toThrow('CSV file appears to be empty or contains no valid data')
  })

  it('should throw error for malformed CSV content', () => {
    const malformedCsv = `firstName,lastName,email
"John,Doe,john@example.com,extra"field`
    expect(() => parseCsv(malformedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with mismatched field count', () => {
    const mismatchedCsv = `firstName,lastName,email
John,Doe,john@example.com,ExtraField,AnotherExtra
Jane,Smith`
    expect(() => parseCsv(mismatchedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with critical delimiter issues', () => {
    const noDelimiterCsv = `firstName lastName email
John Doe john@example.com`
    expect(() => parseCsv(noDelimiterCsv)).toThrow()
  })

  it('should parse valid CSV with all required fields', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode,companyName
John,Doe,john.doe@example.com,Developer,US,Tech Corp`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      jobTitle: 'Developer',
      countryCode: 'US',
      companyName: 'Tech Corp',
      isValid: true,
      errors: [],
      warnings: [],
      rowIndex: 2,
    })
  })

  it('should handle missing required fields and mark as invalid', () => {
    const csv = `firstName,lastName,email
,Smith,john@example.com
John,,john@example.com
John,Smith,`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)

    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('First name is required')

    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('Last name is required')

    expect(result[2].isValid).toBe(false)
    expect(result[2].errors).toContain('Email is required')
  })

  it('should validate email format', () => {
    const csv = `firstName,lastName,email
John,Doe,invalid-email
Jane,Smith,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('Invalid email format')
    expect(result[1].isValid).toBe(true)
  })

  it('should handle CSV with quoted values', () => {
    const csv = `firstName,lastName,email,jobTitle
"John","Doe","john.doe@example.com","Software Engineer"`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john.doe@example.com')
    expect(result[0].jobTitle).toBe('Software Engineer')
  })

  it('should skip empty rows', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
,,
Jane,Smith,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].firstName).toBe('John')
    expect(result[1].firstName).toBe('Jane')
  })

  it('should handle case-insensitive headers', () => {
    const csv = `FIRSTNAME,LASTNAME,EMAIL,JOBTITLE,COUNTRYCODE,COMPANYNAME
John,Doe,john@example.com,Developer,US,Tech Corp`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].jobTitle).toBe('Developer')
  })

  it('should handle missing optional fields', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode
John,Doe,john@example.com,,`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].jobTitle).toBeUndefined()
    expect(result[0].countryCode).toBeUndefined()
    expect(result[0].isValid).toBe(true)
  })

  it('should preserve row index correctly', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
Jane,Smith,jane@example.com
Bob,Johnson,bob@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].rowIndex).toBe(2)
    expect(result[1].rowIndex).toBe(3)
    expect(result[2].rowIndex).toBe(4)
  })

  it('should handle multiple validation errors per lead', () => {
    const csv = `firstName,lastName,email
 , ,invalid-email`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toHaveLength(3)
    expect(result[0].errors).toContain('First name is required')
    expect(result[0].errors).toContain('Last name is required')
    expect(result[0].errors).toContain('Invalid email format')
  })

  it('should handle extra columns not in header mapping', () => {
    const csv = `firstName,lastName,email,unknownColumn
John,Doe,john@example.com,someValue`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].isValid).toBe(true)
  })

  it('should handle mixed valid and invalid leads', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
,Smith,invalid-email
Jane,Johnson,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].isValid).toBe(true)
    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('First name is required')
    expect(result[1].errors).toContain('Invalid email format')
    expect(result[2].isValid).toBe(true)
  })

  it('should handle whitespace in fields', () => {
    const csv = `firstName,lastName,email
 John , Doe , john@example.com `

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].isValid).toBe(true)
  })
})

describe('isValidCountryCode', () => {
  it('returns true for valid ISO 3166-1 alpha-2 codes', () => {
    expect(isValidCountryCode('US')).toBe(true)
    expect(isValidCountryCode('FR')).toBe(true)
    expect(isValidCountryCode('TV')).toBe(true)
    expect(isValidCountryCode('KP')).toBe(true)
  })

  it('is case-insensitive for validity', () => {
    expect(isValidCountryCode('us')).toBe(true)
    expect(isValidCountryCode('Fr')).toBe(true)
  })

  it('returns false for non-two-letter input', () => {
    expect(isValidCountryCode('USA')).toBe(false)
    expect(isValidCountryCode('U')).toBe(false)
    expect(isValidCountryCode('12')).toBe(false)
    expect(isValidCountryCode('U1')).toBe(false)
    expect(isValidCountryCode('')).toBe(false)
  })

  it('returns false for two-letter strings that are not real region codes', () => {
    expect(isValidCountryCode('ZZ')).toBe(false)
    expect(isValidCountryCode('XX')).toBe(false)
  })
})

describe('normalizeCountryCode', () => {
  it('uppercases the input', () => {
    expect(normalizeCountryCode('us')).toBe('US')
    expect(normalizeCountryCode('Fr')).toBe('FR')
    expect(normalizeCountryCode('US')).toBe('US')
  })
})

describe('parseCsv — country code handling', () => {
  const csvWith = (code: string) =>
    `firstName,lastName,email,countryCode\nJohn,Doe,john@example.com,${code}`

  it('preserves a valid uppercase code unchanged with no warning', () => {
    const result = parseCsv(csvWith('US'))
    expect(result[0].countryCode).toBe('US')
    expect(result[0].warnings).toEqual([])
    expect(result[0].isValid).toBe(true)
  })

  it('normalizes a valid lowercase code to uppercase with no warning', () => {
    const result = parseCsv(csvWith('us'))
    expect(result[0].countryCode).toBe('US')
    expect(result[0].warnings).toEqual([])
    expect(result[0].isValid).toBe(true)
  })

  it('normalizes a valid mixed-case code to uppercase with no warning', () => {
    const result = parseCsv(csvWith('Us'))
    expect(result[0].countryCode).toBe('US')
    expect(result[0].warnings).toEqual([])
  })

  it('preserves an invalid 3-letter code raw and emits a warning (still imports)', () => {
    const result = parseCsv(csvWith('USA'))
    expect(result[0].countryCode).toBe('USA')
    expect(result[0].warnings).toEqual(['Invalid country code'])
    expect(result[0].isValid).toBe(true)
  })

  it('preserves an invalid 2-letter non-region code raw and emits a warning', () => {
    const result = parseCsv(csvWith('ZZ'))
    expect(result[0].countryCode).toBe('ZZ')
    expect(result[0].warnings).toEqual(['Invalid country code'])
    expect(result[0].isValid).toBe(true)
  })

  it('preserves a numeric value raw and emits a warning', () => {
    const result = parseCsv(csvWith('12'))
    expect(result[0].countryCode).toBe('12')
    expect(result[0].warnings).toEqual(['Invalid country code'])
    expect(result[0].isValid).toBe(true)
  })

  it('leaves countryCode undefined with no warning when the cell is empty', () => {
    const result = parseCsv(csvWith(''))
    expect(result[0].countryCode).toBeUndefined()
    expect(result[0].warnings).toEqual([])
  })

  it('leaves countryCode undefined with no warning when the column is missing entirely', () => {
    const csv = `firstName,lastName,email\nJohn,Doe,john@example.com`
    const result = parseCsv(csv)
    expect(result[0].countryCode).toBeUndefined()
    expect(result[0].warnings).toEqual([])
  })
})
