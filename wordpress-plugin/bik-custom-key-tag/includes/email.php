<?php
/**
 * Paid-order notification email for custom key tag designs.
 *
 * @package BIK_Custom_Key_Tag
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Collect custom design line items from an order.
 *
 * @param WC_Order $order Order.
 * @return array<int, array{item: WC_Order_Item_Product, design_id: string, preview_url: string, quantity: int}>
 */
function bik_ckt_get_order_design_items( $order ) {
	$found = array();
	foreach ( $order->get_items() as $item ) {
		if ( ! $item instanceof WC_Order_Item_Product ) {
			continue;
		}
		$design_id = $item->get_meta( '_bik_design_id', true );
		if ( ! $design_id ) {
			// Fallback to visible meta label.
			$design_id = $item->get_meta( 'Design ID', true );
		}
		if ( ! $design_id ) {
			continue;
		}
		$found[] = array(
			'item'        => $item,
			'design_id'   => (string) $design_id,
			'preview_url' => (string) $item->get_meta( '_bik_design_preview_url', true ),
			'quantity'    => (int) $item->get_quantity(),
		);
	}
	return $found;
}

/**
 * Parse notification email list from settings.
 *
 * @return string[]
 */
function bik_ckt_get_notification_recipients() {
	$raw   = (string) bik_ckt_get_option( 'notification_emails' );
	$parts = array_filter( array_map( 'trim', explode( ',', $raw ) ) );
	$out   = array();
	foreach ( $parts as $email ) {
		$email = sanitize_email( $email );
		if ( is_email( $email ) ) {
			$out[] = $email;
		}
	}
	return array_values( array_unique( $out ) );
}

/**
 * Build studio admin URL for a design if possible.
 *
 * @param string $design_id Design ID.
 * @return string
 */
function bik_ckt_studio_admin_design_url( $design_id ) {
	$base = untrailingslashit( (string) bik_ckt_get_option( 'studio_base_url' ) );
	if ( '' === $base || '' === $design_id ) {
		return '';
	}
	return $base . '/admin/designs/' . rawurlencode( $design_id );
}

/**
 * Send the paid design notification once per order.
 *
 * @param int      $order_id Order ID.
 * @param WC_Order $order Order object (optional on some hooks).
 */
function bik_ckt_maybe_send_design_email( $order_id, $order = null ) {
	$order_id = absint( $order_id );
	if ( $order_id <= 0 ) {
		return;
	}

	if ( ! $order instanceof WC_Order ) {
		$order = wc_get_order( $order_id );
	}
	if ( ! $order ) {
		return;
	}

	if ( 'yes' === $order->get_meta( '_bik_ckt_email_sent', true ) ) {
		return;
	}

	$design_items = bik_ckt_get_order_design_items( $order );
	if ( empty( $design_items ) ) {
		return;
	}

	$recipients = bik_ckt_get_notification_recipients();
	if ( empty( $recipients ) ) {
		return;
	}

	$customer_name  = trim( $order->get_formatted_billing_full_name() );
	$customer_email = $order->get_billing_email();
	$admin_url      = admin_url( 'post.php?post=' . $order_id . '&action=edit' );
	// HPOS-compatible admin link when available.
	if ( function_exists( 'wc_get_container' ) ) {
		$hpos_url = $order->get_edit_order_url();
		if ( $hpos_url ) {
			$admin_url = $hpos_url;
		}
	}

	$subject = sprintf(
		/* translators: %s: order number */
		__( 'Paid custom key tag order #%s', 'bik-custom-key-tag' ),
		$order->get_order_number()
	);

	$lines   = array();
	$lines[] = sprintf( __( 'Order number: %s', 'bik-custom-key-tag' ), $order->get_order_number() );
	$lines[] = sprintf( __( 'Customer: %s', 'bik-custom-key-tag' ), $customer_name ? $customer_name : '—' );
	$lines[] = sprintf( __( 'Customer email: %s', 'bik-custom-key-tag' ), $customer_email ? $customer_email : '—' );
	$lines[] = '';
	$lines[] = __( 'Custom key tag designs on this order:', 'bik-custom-key-tag' );

	$attachments = array();
	$temp_files  = array();

	foreach ( $design_items as $row ) {
		$lines[] = '';
		$lines[] = sprintf( __( 'Design ID: %s', 'bik-custom-key-tag' ), $row['design_id'] );
		$lines[] = sprintf( __( 'Quantity: %d', 'bik-custom-key-tag' ), $row['quantity'] );

		$studio_url = bik_ckt_studio_admin_design_url( $row['design_id'] );
		if ( $studio_url ) {
			$lines[] = sprintf( __( 'Studio admin: %s', 'bik-custom-key-tag' ), $studio_url );
		}

		if ( ! empty( $row['preview_url'] ) ) {
			$preview = $row['preview_url'];
			if ( 0 === strpos( $preview, 'data:image/' ) ) {
				$attached = bik_ckt_data_url_to_temp_file( $preview, $row['design_id'] );
				if ( $attached ) {
					$attachments[] = $attached;
					$temp_files[]  = $attached;
					$lines[]       = __( 'Preview: attached to this email.', 'bik-custom-key-tag' );
				} else {
					$lines[] = __( 'Preview: (data URL present but could not attach)', 'bik-custom-key-tag' );
				}
			} else {
				$lines[] = sprintf( __( 'Preview: %s', 'bik-custom-key-tag' ), $preview );
			}
		}
	}

	$lines[] = '';
	$lines[] = sprintf( __( 'WooCommerce order admin: %s', 'bik-custom-key-tag' ), $admin_url );

	$body    = implode( "\n", $lines );
	$headers = array( 'Content-Type: text/plain; charset=UTF-8' );

	$sent = wp_mail( $recipients, $subject, $body, $headers, $attachments );

	foreach ( $temp_files as $file ) {
		if ( is_string( $file ) && file_exists( $file ) ) {
			wp_delete_file( $file );
		}
	}

	if ( $sent ) {
		$order->update_meta_data( '_bik_ckt_email_sent', 'yes' );
		$order->update_meta_data( '_bik_ckt_email_sent_at', gmdate( 'c' ) );
		$order->save();
	}
}

/**
 * Convert a data URL image to a temporary file for email attachment.
 *
 * @param string $data_url Data URL.
 * @param string $design_id Design ID (for filename).
 * @return string|false Absolute path or false.
 */
function bik_ckt_data_url_to_temp_file( $data_url, $design_id ) {
	if ( ! preg_match( '#^data:image/(png|jpeg|jpg|gif|webp);base64,#i', $data_url, $m ) ) {
		return false;
	}
	$ext  = strtolower( $m[1] );
	if ( 'jpeg' === $ext ) {
		$ext = 'jpg';
	}
	$b64  = substr( $data_url, strpos( $data_url, ',' ) + 1 );
	$data = base64_decode( $b64, true );
	if ( false === $data || '' === $data ) {
		return false;
	}

	$uploads = wp_upload_dir();
	if ( ! empty( $uploads['error'] ) ) {
		return false;
	}

	$safe_id  = preg_replace( '/[^A-Za-z0-9_-]/', '', $design_id );
	$filename = 'bik-ckt-' . $safe_id . '-' . wp_generate_password( 6, false, false ) . '.' . $ext;
	$path     = trailingslashit( $uploads['basedir'] ) . $filename;

	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
	$written = file_put_contents( $path, $data );
	if ( false === $written ) {
		return false;
	}

	return $path;
}

/**
 * Hook processing and completed; honor settings for which one sends.
 *
 * @param int $order_id Order ID.
 */
function bik_ckt_on_order_status_processing( $order_id ) {
	if ( 'processing' !== bik_ckt_get_option( 'email_trigger' ) ) {
		return;
	}
	bik_ckt_maybe_send_design_email( $order_id );
}
add_action( 'woocommerce_order_status_processing', 'bik_ckt_on_order_status_processing', 20 );

/**
 * @param int $order_id Order ID.
 */
function bik_ckt_on_order_status_completed( $order_id ) {
	if ( 'completed' !== bik_ckt_get_option( 'email_trigger' ) ) {
		return;
	}
	bik_ckt_maybe_send_design_email( $order_id );
}
add_action( 'woocommerce_order_status_completed', 'bik_ckt_on_order_status_completed', 20 );
