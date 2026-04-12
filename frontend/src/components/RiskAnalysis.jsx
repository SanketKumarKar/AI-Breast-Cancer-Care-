import { useState, useRef } from 'react';
import { analyzeImages } from '../utils/api';

export default function RiskAnalysis() {
  const [ccFile, setCcFile] = useState(null);
  const [mloFile, setMloFile] = useState(null);
  const [ccPreview, setCcPreview] = useState(null);
  const [mloPreview, setMloPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  const ccRef = useRef(null);
  const mloRef = useRef(null);
  const resultRef = useRef(null);

  const handleFile = (file, type) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (type === 'cc') {
        setCcFile(file);
        setCcPreview(e.target.result);
      } else {
        setMloFile(file);
        setMloPreview(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file, type);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleAnalyze = async () => {
    if (!ccFile || !mloFile) {
      setError('Please upload both CC and MLO view images.');
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const data = await analyzeImages(ccFile, mloFile);
      setResult(data);
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getRiskClass = (level) => {
    if (!level) return '';
    const l = level.toLowerCase();
    if (l.includes('high')) return 'risk-high';
    if (l.includes('moderate')) return 'risk-moderate';
    return 'risk-low';
  };

  const getProbColor = (prob) => {
    if (prob >= 60) return '#c62828';
    if (prob >= 20) return '#ef6c00';
    return '#2e7d32';
  };

  return (
    <section className="section" id="predict">
      <h2 className="section__title">🔬 AI Risk Analysis</h2>
      <p className="section__subtitle">
        Upload <strong>CC</strong> (Cranio-Caudal) and <strong>MLO</strong> (Medio-Lateral Oblique)
        mammogram views for comprehensive AI analysis powered by Google Gemini.
      </p>

      <div className="analysis">
        {/* Upload Zones */}
        <div className="analysis__upload-zone">
          {/* CC Upload */}
          <div
            className="upload-box"
            onDrop={(e) => handleDrop(e, 'cc')}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => ccRef.current?.click()}
          >
            <span className="upload-box__label">📋 CC View</span>
            <label className="upload-box__btn" onClick={(e) => e.stopPropagation()}>
              ☁️ Choose Image
              <input
                ref={ccRef}
                type="file"
                className="upload-box__input"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files[0], 'cc')}
              />
            </label>
            <div className="upload-box__preview">
              {ccPreview ? (
                <img
                  src={ccPreview}
                  alt="CC Preview"
                  className="upload-box__preview-img"
                  onClick={(e) => { e.stopPropagation(); setLightboxSrc(ccPreview); }}
                />
              ) : (
                <span className="upload-box__placeholder">No image selected</span>
              )}
            </div>
          </div>

          {/* MLO Upload */}
          <div
            className="upload-box"
            onDrop={(e) => handleDrop(e, 'mlo')}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => mloRef.current?.click()}
          >
            <span className="upload-box__label">📋 MLO View</span>
            <label className="upload-box__btn" onClick={(e) => e.stopPropagation()}>
              ☁️ Choose Image
              <input
                ref={mloRef}
                type="file"
                className="upload-box__input"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files[0], 'mlo')}
              />
            </label>
            <div className="upload-box__preview">
              {mloPreview ? (
                <img
                  src={mloPreview}
                  alt="MLO Preview"
                  className="upload-box__preview-img"
                  onClick={(e) => { e.stopPropagation(); setLightboxSrc(mloPreview); }}
                />
              ) : (
                <span className="upload-box__placeholder">No image selected</span>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p style={{ textAlign: 'center', color: '#c62828', marginBottom: 16, fontWeight: 600 }}>
            ⚠️ {error}
          </p>
        )}

        {/* Analyze Button */}
        <button
          className="analyze-btn"
          onClick={handleAnalyze}
          disabled={loading || !ccFile || !mloFile}
        >
          {loading ? '⏳ Analyzing...' : '🧠 Analyze Risk'}
        </button>

        {/* Loading */}
        {loading && (
          <div className="loading-indicator">
            <div className="loading-spinner" />
            <p className="loading-text">Analyzing mammograms with Gemini AI... please wait...</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="results-card" ref={resultRef}>
            <div className="results__header">
              <p className="results__probability-label">Cancer Probability</p>
              <div
                className="results__probability"
                style={{ color: getProbColor(result.probability) }}
              >
                {result.probability}
                <span style={{ fontSize: '1.5rem' }}>%</span>
              </div>
              <span className={`results__risk-badge ${getRiskClass(result.riskLevel)}`}>
                {result.riskLevel}
              </span>
            </div>

            {/* Analysis Basis */}
            {result.analysisBasis && (
              <div className="results__analysis">
                <h4 className="results__analysis-title">📝 Analysis Summary</h4>
                <p className="results__analysis-text">{result.analysisBasis}</p>
                {result.biradsDensity && (
                  <p className="results__analysis-text" style={{ marginTop: 8 }}>
                    <strong>BI-RADS Density:</strong> {result.biradsDensity}
                  </p>
                )}
                {result.areaOfConcern && result.areaOfConcern.location !== 'none' && (
                  <p className="results__analysis-text" style={{ marginTop: 8 }}>
                    <strong>Area of Concern:</strong> {result.areaOfConcern.description} ({result.areaOfConcern.location})
                  </p>
                )}
              </div>
            )}

            {/* Findings */}
            {result.findings && result.findings.length > 0 && (
              <div className="results__findings">
                <h4 className="results__findings-title">🔍 Detailed Findings</h4>
                {result.findings.map((f, i) => (
                  <div key={i} className="results__finding-item">
                    <span className="results__finding-bullet">•</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="results__recommendations">
                <h4 className="results__recommendations-title">💡 Recommendations</h4>
                {result.recommendations.map((r, i) => (
                  <div key={i} className="results__recommendation-item">
                    <span>✓</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Disclaimer */}
            <div className="results__disclaimer">
              ⚠️ {result.disclaimer || 'This AI analysis is for educational and screening assistance only. It does NOT replace a professional medical diagnosis. Please consult a qualified healthcare provider.'}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div className="lightbox" onClick={() => setLightboxSrc(null)}>
          <button className="lightbox__close" onClick={() => setLightboxSrc(null)}>
            ×
          </button>
          <img src={lightboxSrc} alt="Zoomed view" className="lightbox__img" />
        </div>
      )}
    </section>
  );
}
