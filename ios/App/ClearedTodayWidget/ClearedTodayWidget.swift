import SwiftUI
import WidgetKit

struct PocketSnapshot: Decodable {
    let version: Int
    let amountText: String
    let hidden: Bool
    let updatedAt: Double
    let expiresAt: Double
}

struct PocketEntry: TimelineEntry {
    let date: Date
    let snapshot: PocketSnapshot?
    var valid: Bool {
        guard let snapshot = snapshot else { return false }
        return snapshot.version == 1 && snapshot.expiresAt / 1000 > date.timeIntervalSince1970
            && snapshot.updatedAt / 1000 <= date.timeIntervalSince1970
    }
}

struct PocketProvider: TimelineProvider {
    func placeholder(in context: Context) -> PocketEntry {
        PocketEntry(date: Date(), snapshot: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (PocketEntry) -> Void) {
        completion(PocketEntry(date: Date(), snapshot: readSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PocketEntry>) -> Void) {
        let now = Date()
        let snapshot = readSnapshot()
        var entries = [PocketEntry(date: now, snapshot: snapshot)]
        // Midnight is a real state change, not a promise of a background fetch.
        // A precomputed entry hides yesterday's allowance even with the app closed.
        if let snapshot = snapshot {
            let expiry = Date(timeIntervalSince1970: snapshot.expiresAt / 1000)
            if expiry > now { entries.append(PocketEntry(date: expiry, snapshot: snapshot)) }
        }
        completion(Timeline(entries: entries, policy: .never))
    }

    private func readSnapshot() -> PocketSnapshot? {
        guard let data = UserDefaults(suiteName: "group.app.pocketcfo.mobile")?.data(forKey: "snapshot") else { return nil }
        return try? JSONDecoder().decode(PocketSnapshot.self, from: data)
    }
}

struct PocketWidgetView: View {
    let entry: PocketEntry
    @Environment(\.widgetFamily) private var family
    private let yellow = Color(red: 0.98, green: 0.8, blue: 0.08)
    private let muted = Color(red: 0.67, green: 0.69, blue: 0.73)
    private let surface = Color(red: 0.106, green: 0.118, blue: 0.133)

    var body: some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(surface, for: .widget)
        } else {
            content.padding().background(surface)
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Cleared Today").font(.caption).foregroundStyle(muted)
                Spacer()
                if family == .systemMedium {
                    Text("Pocket CFO").font(.caption.weight(.semibold)).foregroundStyle(muted)
                }
            }
            Text(entry.snapshot?.hidden == true ? "••••" : entry.valid ? entry.snapshot!.amountText : "—")
                .font(.system(size: family == .systemMedium ? 38 : 30, weight: .bold, design: .rounded))
                .monospacedDigit().foregroundStyle(.white)
                .lineLimit(1).minimumScaleFactor(0.4).privacySensitive()
            detail.font(.system(size: 11)).foregroundStyle(muted).lineLimit(2)
            Spacer(minLength: 0)
            if family == .systemMedium {
                Link(destination: URL(string: "app.pocketcfo.mobile://spend")!) { action }
            } else {
                action
            }
        }
        // Small widgets have a single tap destination; medium widgets also
        // expose a distinct Log Spend link while the background opens Home.
        .widgetURL(URL(string: family == .systemSmall ? "app.pocketcfo.mobile://spend" : "app.pocketcfo.mobile://home"))
    }

    private var detail: Text {
        guard let snapshot = entry.snapshot else { return Text("Open Pocket CFO to get started") }
        if snapshot.hidden { return Text("Amount hidden") }
        if !entry.valid { return Text("Open to refresh today's amount") }
        return Text("Updated \(Date(timeIntervalSince1970: snapshot.updatedAt / 1000), style: .time)")
    }

    private var action: some View {
        Text("+ Log Spend").font(.system(size: 13, weight: .semibold))
            .foregroundStyle(.black).frame(maxWidth: .infinity).padding(.vertical, 9)
            .background(yellow, in: RoundedRectangle(cornerRadius: 10))
    }
}

@main
struct ClearedTodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "ClearedTodayWidget", provider: PocketProvider()) { entry in
            PocketWidgetView(entry: entry)
        }
        .configurationDisplayName("Cleared Today")
        .description("See what is cleared to spend and quickly log a purchase.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
