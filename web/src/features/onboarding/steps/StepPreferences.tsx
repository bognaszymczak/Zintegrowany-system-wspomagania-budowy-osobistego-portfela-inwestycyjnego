import { CURRENCY_OPTIONS, EXCLUSION_OPTIONS, INSTRUMENTS_OPTIONS } from '@/domain/questionnaire';
import { ChoiceGroup } from '../fields/ChoiceGroup';
import { CheckboxField } from '../fields/CheckboxField';
import { Question } from '../fields/Question';

/** Krok 5 — wykluczenia, ESG, rodzaj instrumentów i waluta. */
export function StepPreferences() {
  return (
    <>
      <Question id="q-exclusions" title="Czego nie chcesz w portfelu?">
        <div className="checks">
          {EXCLUSION_OPTIONS.map((o) => (
            <CheckboxField key={o.value} name={`exclusions.${o.value}`}>
              {o.label}
            </CheckboxField>
          ))}
        </div>
        <div className="checks checks--single">
          <CheckboxField name="esg">Wolę fundusze zrównoważone (ESG), jeśli są dostępne</CheckboxField>
        </div>
      </Question>

      <ChoiceGroup
        name="typ"
        title="Z czego mają składać się portfele?"
        options={INSTRUMENTS_OPTIONS}
        variant="list"
      />

      <ChoiceGroup
        name="ccy"
        title="W jakiej walucie pokazywać wyniki?"
        options={CURRENCY_OPTIONS}
        hint="Przeliczamy po kursie NBP z dnia notowania."
      />
    </>
  );
}
