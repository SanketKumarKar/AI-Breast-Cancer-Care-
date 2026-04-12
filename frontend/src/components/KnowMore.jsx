import { useState } from 'react';

const sections = [
  {
    title: 'Overview',
    content:
      'Breast cancer is a disease in which abnormal cells in the breast grow uncontrollably and form a malignant tumor. These cells can invade nearby tissues and spread through the lymphatic system and bloodstream to distant organs. Although it mainly affects women, men can also develop breast cancer. Early detection greatly increases survival and treatment success.',
  },
  {
    title: 'Breast Anatomy',
    content:
      'The breast consists of lobules that produce milk, ducts that carry milk to the nipple, fatty tissue that gives shape, connective tissue that provides support, and lymph nodes that fight infection. Most cancers start in the ducts or lobules and may spread to lymph nodes and vital organs.',
  },
  {
    title: 'Types of Breast Cancer',
    content:
      'DCIS is a non-invasive form confined to milk ducts. IDC spreads beyond ducts into nearby tissue. ILC begins in lobules and spreads silently. TNBC lacks hormone receptors and is aggressive. HER2-positive cancer grows fast but responds to targeted therapy. Inflammatory breast cancer is rare, fast-growing, and causes swelling and redness.',
  },
  {
    title: 'Causes and Risk Factors',
    content:
      'Breast cancer develops due to genetic, hormonal, and lifestyle factors. BRCA1 and BRCA2 gene mutations increase risk. Early menstruation, late menopause, hormone therapy, smoking, alcohol, obesity, poor diet, and lack of exercise also contribute.',
  },
  {
    title: 'Signs and Symptoms',
    content:
      'A lump in the breast or underarm, changes in breast size or shape, skin dimpling, nipple discharge, breast pain, redness, or swelling. Early stages may have no symptoms, making screening essential.',
  },
  {
    title: 'Stages of Breast Cancer',
    content:
      'Stage 0 is non-invasive. Stage I is localized. Stage II involves nearby lymph nodes. Stage III spreads to surrounding tissues or multiple nodes. Stage IV spreads to distant organs like lungs, liver, or bones.',
  },
  {
    title: 'Diagnosis',
    content:
      'Diagnosis includes self-exams, clinical exams, mammograms, ultrasound, biopsy, and MRI to determine cancer type and stage.',
  },
  {
    title: 'Treatment Options',
    content:
      'Treatment may include surgery, radiation therapy, chemotherapy, hormone therapy, targeted therapy, and immunotherapy depending on the case.',
  },
  {
    title: 'Prevention and Early Detection',
    content:
      'Healthy lifestyle choices, avoiding tobacco and alcohol, maintaining weight, regular exercise, breastfeeding, and routine screening reduce risk.',
  },
  {
    title: 'Emotional and Social Impact',
    content:
      'Breast cancer affects mental and emotional health. Support from family, friends, counselors, and survivor groups is essential.',
  },
  {
    title: 'Awareness and Hope',
    content:
      'The pink ribbon represents hope. With early detection and modern treatments, many people live long, fulfilling lives.',
  },
];

export default function KnowMore() {
  const [openIdx, setOpenIdx] = useState(null);

  const toggle = (idx) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section className="section" id="info">
      <h2 className="section__title">Know More About Breast Cancer</h2>
      <p className="section__subtitle">
        Understanding breast cancer is the first step toward prevention and early detection
      </p>

      <div className="knowmore">
        {sections.map((s, idx) => (
          <div className="accordion-item" key={idx}>
            <button
              className={`accordion-trigger${openIdx === idx ? ' open' : ''}`}
              onClick={() => toggle(idx)}
            >
              {s.title}
              <span className="accordion-trigger__icon">▾</span>
            </button>
            <div className={`accordion-content${openIdx === idx ? ' open' : ''}`}>
              <div className="accordion-content__inner">{s.content}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
