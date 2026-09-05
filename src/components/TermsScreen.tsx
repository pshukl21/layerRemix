import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export const TermsScreen: React.FC = () => {
  return (
    <div className="w-full min-h-screen text-slate-900 pt-24 pb-20 px-6 md:px-12 max-w-3xl mx-auto">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 uppercase tracking-widest mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Explore
      </Link>

      <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-slate-400 font-semibold mb-8">Last updated: September 5, 2026</p>

      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-10">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 font-semibold leading-relaxed">
          This Terms of Service has not yet been reviewed by a legal professional.
        </p>
      </div>

      <div className="prose-sm space-y-8 text-sm text-slate-700 font-semibold leading-relaxed">
        <Section title="1. Acceptance of Terms">
          <p>
            By accessing or using LayerRemix ("the Service," "we," "us"), you agree to be bound by these Terms of
            Service. If you do not agree to these terms, do not use the Service.
          </p>
        </Section>

        <Section title="2. Accounts & Credits">
          <p>
            Creating an account requires a valid email address. You are responsible for maintaining the security of
            your account and for all activity that occurs under it.
          </p>
          <p>
            The Service uses a credit system: publishing an original artwork or a remix earns credits, and
            downloading another user's source file spends a credit. Credits have no cash value, cannot be purchased,
            sold, or transferred outside the mechanisms built into the Service, and are not redeemable for money.
            We may adjust the credit system's rules at any time.
          </p>
        </Section>

        <Section title="3. Your Content">
          <p>
            You retain ownership of any artwork and source files ("Content") you upload. By uploading Content, you
            grant LayerRemix a worldwide, non-exclusive, royalty-free license to host, display, and distribute that
            Content through the Service, and you grant other users of the Service the right to download, remix, and
            publish derivative works built from your Content, consistent with how the Service is designed to work.
          </p>
          <p>
            You are solely responsible for the Content you upload. By uploading, you represent that you own the
            rights to the Content, or have all necessary rights and permissions to upload it and to grant the
            licenses described above — including rights to any third-party material, likenesses, trademarks, or
            copyrighted elements incorporated into it.
          </p>
          <p>
            <span className="font-black">This applies in full to fan art, sports art, and other derivative
            compositions</span>, including work built from licensed photography, team or league trademarks, or a
            real person's likeness. Whether such a use qualifies as fair use, or otherwise doesn't require
            permission, depends on factors specific to each piece — it is not automatically permitted merely because
            the Service is free to use or Content is shared without payment. The licenses you grant under this
            Section do not, and cannot, grant you or anyone else any right to use third-party material beyond what
            the actual rights holder has authorized. If the underlying material was used without the necessary
            rights, that responsibility remains with the person who uploaded it, not with LayerRemix.
          </p>
        </Section>

        <Section title="4. Prohibited Content & Conduct">
          <p>You may not upload, publish, or share Content that:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Infringes another party's copyright, trademark, or other intellectual property rights;</li>
            <li>Is unlawful, defamatory, obscene, or violates any third party's rights, including rights of publicity or privacy;</li>
            <li>Contains malware or is intended to disrupt or damage the Service;</li>
            <li>Impersonates any person or entity, or misrepresents your affiliation with any person or entity;</li>
            <li>You do not have the necessary rights or permissions to share.</li>
          </ul>
          <p>
            You may not attempt to circumvent the credit system, manipulate engagement metrics, upload files that
            misrepresent their actual content, or otherwise abuse the Service's intended functionality.
          </p>
        </Section>

        <Section title="5. Reporting & Removal of Content">
          <p>
            If you believe Content on the Service infringes your rights or violates these Terms, you may report it
            using the "Report" option available on any artwork page. We review reports and may, at our discretion,
            remove Content, suspend accounts, or take other action we consider appropriate. We are not obligated to
            take any specific action in response to a report, and reviewing a report does not guarantee removal.
          </p>
          <p>
            [If you intend to operate in the U.S. and want formal DMCA safe-harbor protection, add a designated
            copyright agent and formal DMCA takedown/counter-notice process here — this is a distinct legal
            requirement beyond general content moderation, and a lawyer should help you set this up correctly.]
          </p>
        </Section>

        <Section title="6. Intellectual Property">
          <p>
            The Service itself — its design, branding, and underlying software — is owned by LayerRemix and
            protected by applicable intellectual property laws. These Terms do not grant you any rights to
            LayerRemix's own trademarks, logos, or brand assets.
          </p>
        </Section>

        <Section title="7. Disclaimer of Warranties">
          <p>
            The Service is provided "as is" and "as available," without warranties of any kind, express or implied.
            We do not warrant that the Service will be uninterrupted, error-free, or free of harmful components, or
            that any Content will be accurate, appropriate, or non-infringing.
          </p>
        </Section>

        <Section title="8. Limitation of Liability">
          <p>
            To the fullest extent permitted by law, LayerRemix and its operators will not be liable for any
            indirect, incidental, special, consequential, or punitive damages, or any loss of data, arising from
            your use of the Service or any Content accessed through it.
          </p>
        </Section>

        <Section title="9. Termination">
          <p>
            We may suspend or terminate your access to the Service at any time, with or without notice, for conduct
            that violates these Terms or that we believe is harmful to other users, us, or third parties.
          </p>
        </Section>

        <Section title="10. Changes to These Terms">
          <p>
            We may update these Terms from time to time. Continued use of the Service after changes take effect
            constitutes acceptance of the revised Terms.
          </p>
        </Section>

        <Section title="11. Governing Law">
          <p>These Terms are governed by the laws of [JURISDICTION], without regard to conflict-of-law principles.</p>
        </Section>

        <Section title="12. Contact">
          <p>Questions about these Terms can be sent to [CONTACT EMAIL].</p>
        </Section>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h2 className="text-base font-black text-slate-900 mb-2">{title}</h2>
    <div className="space-y-2 [&_ul]:mt-1">{children}</div>
  </div>
);
