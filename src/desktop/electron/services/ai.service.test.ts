import { describe, expect, it } from 'vitest';
import { containsProhibitedEstimateLanguage } from './ai.service';

describe('containsProhibitedEstimateLanguage', () => {
  it('flags LM Studio answers that estimate or calculate missing data', () => {
    expect(
      containsProhibitedEstimateLanguage(
        'The data is not directly available, however we can calculate it using the global pass rate. Failed trainees are approximately 384.'
      )
    ).toBe(true);
    expect(
      containsProhibitedEstimateLanguage(
        'This is an estimate derived from aggregate totals and should be roughly 20.'
      )
    ).toBe(true);
    expect(
      containsProhibitedEstimateLanguage(
        'This specific data is not available in the dataset. However, it can be inferred that 383 trainees failed.'
      )
    ).toBe(true);
    expect(
      containsProhibitedEstimateLanguage(
        'Pass rate can be calculated by dividing passed records by total records.'
      )
    ).toBe(true);
  });

  it('allows exact database wording without estimate language', () => {
    expect(
      containsProhibitedEstimateLanguage(
        'Exact database result: found 383 failed performance records. Every value comes from matching performance records.'
      )
    ).toBe(false);
  });
});
